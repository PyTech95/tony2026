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


def _headers():
    if not PRINTFUL_TOKEN:
        raise HTTPException(400, "Printful is not configured (missing PRINTFUL_TOKEN).")
    h = {"Authorization": f"Bearer {PRINTFUL_TOKEN}", "Content-Type": "application/json"}
    if PRINTFUL_STORE_ID:
        h["X-PF-Store-Id"] = PRINTFUL_STORE_ID
    return h


async def _pf_get(client: httpx.AsyncClient, path: str, **kw):
    r = await client.get(f"{BASE}{path}", headers=_headers(), **kw)
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
    cover = sp.get("thumbnail_url")
    all_imgs = ([cover] if cover else []) + [i for v in variants for i in v["images"]]
    return {
        "printful_product_id": sp.get("id"),
        "title": sp.get("name", "Untitled"),
        "images": list(dict.fromkeys(all_imgs))[:8],
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
        "store_id": PRINTFUL_STORE_ID,
        "synced_products": count,
        "last_sync": (meta or {}).get("last_sync"),
        "last_result": (meta or {}).get("last_result"),
    }


@api.post("/admin/printful/sync")
async def printful_sync(request: Request):
    await require_role(request, ["admin"])
    if not PRINTFUL_TOKEN:
        raise HTTPException(400, "Printful is not configured (missing PRINTFUL_TOKEN).")
    created = updated = 0
    async with httpx.AsyncClient(timeout=40) as client:
        # Paginate the sync-product list
        summaries: List[dict] = []
        offset = 0
        while True:
            page = await _pf_get(client, "/store/products", params={"offset": offset, "limit": 100})
            items = page if isinstance(page, list) else page.get("items", [])
            summaries += items
            if len(items) < 100:
                break
            offset += 100
        for s in summaries:
            full = await _pf_get(client, f"/store/products/{s['id']}")
            doc = _normalize(full)
            existing = await db.products.find_one({"printful_product_id": doc["printful_product_id"]})
            pf_owned = {
                "variants": doc["variants"],
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
        {"$set": {"key": "printful_sync", "last_sync": now_utc().isoformat(), "last_result": result}},
        upsert=True,
    )
    return result
