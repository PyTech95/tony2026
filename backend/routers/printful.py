"""Printful print-on-demand integration (Part A: product sync + admin edit).

Syncs products from the Printful Manual Order / API store into our `products`
collection. Local merchandising fields (category, visible, price/title overrides)
are preserved across syncs; Printful owns variants + source images.
Order fulfillment (Part B) is intentionally not wired yet.
"""
import os
from typing import Any, List
import httpx
from fastapi import Request, HTTPException

from core import api, db, gen_id, now_utc, require_role

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
    return {
        "configured": cfg,
        "store_id": (meta or {}).get("store_id") or PRINTFUL_STORE_ID,
        "synced_products": count,
        "last_sync": (meta or {}).get("last_sync"),
        "last_result": (meta or {}).get("last_result"),
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
