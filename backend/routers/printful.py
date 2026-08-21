"""Printful print-on-demand integration.

Part A: product sync + admin edit (syncs products from a Printful store into our
`products` collection; local merchandising fields are preserved across syncs).
Part B: order fulfillment — after a cart order is paid, push it to Printful for
printing & shipping, and receive tracking via the package_shipped webhook.
"""
import os
from typing import Any, List
import httpx
from fastapi import Request, HTTPException

from core import api, db, logger, gen_id, now_utc, require_role

PRINTFUL_TOKEN = os.environ.get("PRINTFUL_TOKEN")
PRINTFUL_STORE_ID = os.environ.get("PRINTFUL_STORE_ID")
BASE = "https://api.printful.com"


def _img_url(u: str) -> str:
    """The old WordPress domain tonyoga.com now serves the web app (images 404),
    but the same media still lives on tonyoga.online (no hotlink protection)."""
    if not u:
        return u
    return u.replace("://www.tonyoga.com/", "://tonyoga.online/").replace("://tonyoga.com/", "://tonyoga.online/")


def _headers(store_id=None):
    if not PRINTFUL_TOKEN:
        raise HTTPException(400, "Printful is not configured (missing PRINTFUL_TOKEN).")
    h = {"Authorization": f"Bearer {PRINTFUL_TOKEN}", "Content-Type": "application/json"}
    sid = store_id or PRINTFUL_STORE_ID
    if sid:
        h["X-PF-Store-Id"] = str(sid)
    return h


async def _selected_store_id():
    meta = await db.app_settings.find_one({"key": "printful_sync"}, {"_id": 0})
    return (meta or {}).get("store_id") or PRINTFUL_STORE_ID


async def _pf_get(client: httpx.AsyncClient, path: str, store_id=None, **kw):
    r = await client.get(f"{BASE}{path}", headers=_headers(store_id), **kw)
    if r.status_code >= 400:
        raise HTTPException(502, f"Printful error {r.status_code}: {r.text[:200]}")
    body = r.json()
    return body.get("result", body)


def _normalize(full: dict) -> dict:
    sp = full.get("sync_product", full)
    svs = full.get("sync_variants", [])
    variants: List[dict] = []
    prices = []
    currency = "usd"
    cdn_imgs: List[str] = []  # Printful CDN images (load anywhere)
    for v in svs:
        try:
            price = float(v.get("retail_price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price:
            prices.append(price)
        currency = (v.get("currency") or currency).lower()
        files = v.get("files", [])
        imgs = [f.get("preview_url") for f in files if f.get("preview_url")]
        pimg = (v.get("product") or {}).get("image")
        if pimg:
            imgs.append(pimg)
        cdn_imgs += imgs
        variants.append({
            "printful_variant_id": v.get("id"),
            "catalog_variant_id": v.get("variant_id"),
            "sku": v.get("sku"),
            "size": v.get("size") or v.get("name"),
            "color": v.get("color"),
            "price": price,
            "images": imgs,
            "available": v.get("availability_status", "active") != "discontinued",
        })
    # Prefer Printful CDN images; fall back to the (proxied) platform thumbnail.
    ordered = list(dict.fromkeys(cdn_imgs))
    thumb = sp.get("thumbnail_url")
    if thumb:
        ordered.append(thumb)
    all_imgs = [_img_url(u) for u in dict.fromkeys(ordered) if u]
    return {
        "printful_product_id": sp.get("id"),
        "title": sp.get("name", "Untitled"),
        "images": all_imgs[:8],
        "variants": variants,
        "price": round(min(prices), 2) if prices else 0.0,
        "currency": currency,
    }


@api.get("/admin/printful/status")
async def printful_status(request: Request):
    await require_role(request, ["admin"])
    cfg = bool(PRINTFUL_TOKEN)
    meta = await db.app_settings.find_one({"key": "printful_sync"}, {"_id": 0})
    count = await db.products.count_documents({"source": "printful"})
    from routers.settings import get_setting
    fulfill_enabled = await get_setting("printful_fulfill_enabled")
    live = await _is_live_payments()
    return {
        "configured": cfg,
        "store_id": (meta or {}).get("store_id") or PRINTFUL_STORE_ID,
        "synced_products": count,
        "last_sync": (meta or {}).get("last_sync"),
        "last_result": (meta or {}).get("last_result"),
        "fulfill_enabled": fulfill_enabled is not False,  # default on
        "payments_live": live,
    }


@api.get("/admin/printful/stores")
async def printful_stores(request: Request):
    """List all Printful stores on the account with a live product count each."""
    await require_role(request, ["admin"])
    if not PRINTFUL_TOKEN:
        raise HTTPException(400, "Printful is not configured (missing PRINTFUL_TOKEN).")
    selected = await _selected_store_id()
    out = []
    async with httpx.AsyncClient(timeout=40) as client:
        stores = await _pf_get(client, "/stores")
        for st in (stores or []):
            sid = st.get("id")
            count = None
            try:
                r = await client.get(
                    f"{BASE}/sync/products", headers=_headers(sid),
                    params={"limit": 1, "offset": 0},
                )
                if r.status_code < 400:
                    count = ((r.json() or {}).get("paging") or {}).get("total")
            except Exception:
                count = None
            out.append({
                "id": sid, "name": st.get("name"), "type": st.get("type"), "product_count": count,
            })
    return {"stores": out, "selected_store_id": str(selected) if selected else None}


@api.post("/admin/printful/sync")
async def printful_sync(request: Request):
    await require_role(request, ["admin"])
    if not PRINTFUL_TOKEN:
        raise HTTPException(400, "Printful is not configured (missing PRINTFUL_TOKEN).")
    try:
        body = await request.json()
    except Exception:
        body = {}
    store_id = str(body.get("store_id") or "").strip() or await _selected_store_id()
    if not store_id:
        raise HTTPException(400, "No Printful store selected.")
    created = updated = 0
    async with httpx.AsyncClient(timeout=60) as client:
        # Paginate the sync-product list (works for platform stores too)
        summaries: List[dict] = []
        offset = 0
        while True:
            page = await _pf_get(client, "/sync/products", store_id=store_id, params={"offset": offset, "limit": 100})
            items = page if isinstance(page, list) else page.get("items", [])
            summaries += items
            if len(items) < 100:
                break
            offset += 100
        for s in summaries:
            full = await _pf_get(client, f"/sync/products/{s['id']}", store_id=store_id)
            doc = _normalize(full)
            existing = await db.products.find_one({"printful_product_id": doc["printful_product_id"]})
            pf_owned = {
                "variants": doc["variants"],
                "images": doc["images"],
                "source": "printful",
                "printful_store_id": str(store_id),
                "printful_synced_at": now_utc().isoformat(),
            }
            if existing:
                # Preserve admin overrides; only refresh Printful-owned data + fill blanks.
                await db.products.update_one({"id": existing["id"]}, {"$set": pf_owned})
                updated += 1
            else:
                new = {
                    "id": gen_id(),
                    "title": doc["title"],
                    "description": "",
                    "type": "physical",
                    "category": "Printful",
                    "price": doc["price"],
                    "currency": doc["currency"],
                    "stock_qty": 999,
                    "images": doc["images"],
                    "visible": True,
                    "printful_product_id": doc["printful_product_id"],
                    "rating": 0,
                    "created_at": now_utc().isoformat(),
                    **pf_owned,
                }
                await db.products.insert_one(new)
                created += 1
    result = {"created": created, "updated": updated, "total": created + updated}
    await db.app_settings.update_one(
        {"key": "printful_sync"},
        {"$set": {"key": "printful_sync", "store_id": str(store_id), "last_sync": now_utc().isoformat(), "last_result": result}},
        upsert=True,
    )
    return result



# ---------------------------------------------------------------------------
# Part B — Order fulfillment
# ---------------------------------------------------------------------------

# Minimal country-name -> ISO2 map for the addresses we capture at checkout.
_COUNTRY_ISO2 = {
    "united states": "US", "usa": "US", "us": "US",
    "united kingdom": "GB", "uk": "GB", "great britain": "GB",
    "spain": "ES", "espana": "ES", "españa": "ES",
    "canada": "CA", "australia": "AU", "germany": "DE", "france": "FR",
    "italy": "IT", "portugal": "PT", "ireland": "IE", "netherlands": "NL",
    "mexico": "MX", "india": "IN",
}


def _country_code(name: str) -> str:
    n = (name or "").strip()
    if len(n) == 2:
        return n.upper()
    return _COUNTRY_ISO2.get(n.lower(), n[:2].upper() if n else "US")


def _order_recipient(order: dict) -> dict:
    a = order.get("shipping_address") or {}
    r = {
        "name": a.get("name") or order.get("user_email", "Customer"),
        "address1": a.get("line1") or "",
        "city": a.get("city") or "",
        "state_code": (a.get("state") or None),
        "country_code": _country_code(a.get("country")),
        "zip": a.get("postal_code") or "",
    }
    if a.get("line2"):
        r["address2"] = a["line2"]
    if a.get("phone"):
        r["phone"] = a["phone"]
    if order.get("user_email"):
        r["email"] = order["user_email"]
    return r


async def _resolve_items(order: dict):
    """Map an order's line items to Printful sync_variant_ids. Returns (items, skipped, store_id)."""
    items: List[dict] = []
    skipped: List[str] = []
    store_id = None
    for line in order.get("items", []):
        pid = line.get("product_id")
        p = await db.products.find_one({"id": pid}) if pid else None
        variants = (p or {}).get("variants") or []
        if not p or p.get("source") != "printful" or not variants:
            skipped.append((p or line).get("title") or str(pid))
            continue
        want = str(line.get("variant") or "").strip().lower()
        chosen = None
        if want:
            chosen = next(
                (v for v in variants
                 if str(v.get("size") or "").lower() == want or str(v.get("color") or "").lower() == want),
                None,
            )
        chosen = chosen or variants[0]
        svid = chosen.get("printful_variant_id")
        if not svid:
            skipped.append(p.get("title") or str(pid))
            continue
        # All Printful items in an order should share a store; use the first product's store.
        if store_id is None and p.get("printful_store_id"):
            store_id = str(p["printful_store_id"])
        items.append({"sync_variant_id": int(svid), "quantity": int(line.get("quantity", 1) or 1)})
    return items, skipped, store_id


async def _pf_post(client: httpx.AsyncClient, path: str, json=None, params=None, store_id=None):
    r = await client.post(f"{BASE}{path}", headers=_headers(store_id), json=json, params=params)
    if r.status_code >= 400:
        raise HTTPException(502, f"Printful error {r.status_code}: {r.text[:300]}")
    body = r.json()
    return body.get("result", body)


async def submit_printful_order(order: dict, confirm: bool) -> dict:
    """Create a Printful order for the given order's Printful line items.
    confirm=False -> draft (review in Printful); confirm=True -> submit for fulfillment."""
    if not PRINTFUL_TOKEN:
        raise HTTPException(400, "Printful is not configured (missing PRINTFUL_TOKEN).")
    items, skipped, store_id = await _resolve_items(order)
    store_id = store_id or await _selected_store_id()
    if not items:
        raise HTTPException(400, f"No Printful items in this order (skipped: {', '.join(skipped) or 'none'})")
    payload = {"recipient": _order_recipient(order), "items": items}
    async with httpx.AsyncClient(timeout=45) as client:
        res = await _pf_post(client, "/orders", json=payload, params={"confirm": 1 if confirm else 0}, store_id=store_id)
    upd = {
        "printful_order_id": res.get("id"),
        "printful_status": res.get("status"),
        "printful_confirmed": bool(confirm),
        "printful_synced_at": now_utc().isoformat(),
        "fulfillment_skipped_items": skipped,
        "fulfillment_error": None,
    }
    await db.orders.update_one({"id": order["id"]}, {"$set": upd})
    return {"printful_order_id": res.get("id"), "status": res.get("status"), "skipped": skipped}


async def _is_live_payments() -> bool:
    try:
        from routers.settings import get_setting
        mode = (await get_setting("paypal_mode")) or os.environ.get("PAYPAL_MODE", "sandbox")
        stripe_key = (await get_setting("stripe_secret_key")) or os.environ.get("STRIPE_API_KEY", "")
        return mode == "live" or str(stripe_key).startswith("sk_live")
    except Exception:
        return False


async def try_auto_fulfill_order(order_id: str):
    """Best-effort: called after a cart order is paid. Auto-confirms a Printful
    order ONLY when real (live) payments are active; otherwise records a
    skipped-in-test-mode marker so nothing is charged during sandbox testing."""
    try:
        if not PRINTFUL_TOKEN:
            return
        from routers.settings import get_setting
        if (await get_setting("printful_fulfill_enabled")) is False:
            return
        order = await db.orders.find_one({"id": order_id})
        if not order or order.get("printful_order_id"):
            return
        items, skipped, _store = await _resolve_items(order)
        if not items:
            return  # nothing Printful can fulfill (all manual products)
        if not await _is_live_payments():
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"printful_status": "skipped_test_mode", "fulfillment_skipped_items": skipped}},
            )
            logger.info(f"[printful] auto-fulfill skipped for order {order_id} (payments not live)")
            return
        await submit_printful_order(order, confirm=True)
        logger.info(f"[printful] auto-confirmed fulfillment for order {order_id}")
    except Exception as e:
        logger.warning(f"[printful] auto-fulfill failed for {order_id}: {e}")
        await db.orders.update_one({"id": order_id}, {"$set": {"fulfillment_error": str(e)[:300]}})


@api.post("/admin/orders/{order_id}/fulfill")
async def admin_fulfill_order(order_id: str, request: Request, confirm: bool = False):
    await require_role(request, ["admin"])
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    return await submit_printful_order(order, confirm=confirm)


@api.get("/admin/orders/{order_id}/fulfillment")
async def admin_order_fulfillment(order_id: str, request: Request):
    await require_role(request, ["admin"])
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order or not order.get("printful_order_id"):
        raise HTTPException(404, "Order not sent to Printful yet")
    store_id = await _selected_store_id()
    async with httpx.AsyncClient(timeout=30) as client:
        res = await _pf_get(client, f"/orders/{order['printful_order_id']}", store_id=store_id)
    shipments = res.get("shipments") or []
    if shipments:
        s0 = shipments[0]
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"tracking_number": s0.get("tracking_number"),
                      "tracking_url": s0.get("tracking_url"),
                      "printful_status": res.get("status")}},
        )
    return res


@api.post("/webhook/printful")
async def printful_webhook(request: Request):
    """Printful webhook — package_shipped delivers tracking. Idempotent."""
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    if event.get("type") == "package_shipped":
        data = event.get("data", {}) or {}
        ship = data.get("shipment", {}) or {}
        order = data.get("order", {}) or {}
        pf_id = order.get("id")
        if pf_id:
            await db.orders.update_one(
                {"printful_order_id": pf_id},
                {"$set": {"status": "shipped", "printful_status": "shipped",
                          "tracking_number": ship.get("tracking_number"),
                          "tracking_url": ship.get("tracking_url"),
                          "shipped_at": now_utc().isoformat()}},
            )
    return {"received": True}
