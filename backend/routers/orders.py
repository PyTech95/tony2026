"""Shipping & orders module: cart address capture + admin order fulfillment."""
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from core import api, db, now_utc, gen_id, get_current_user, require_role


class ShippingAddress(BaseModel):
    name: str
    line1: str
    line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str
    phone: Optional[str] = None


class OrderCreate(BaseModel):
    items: List[Dict[str, Any]]  # [{product_id, quantity, variant?}]
    shipping_address: ShippingAddress
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    order_id: str
    status: str  # pending | paid | fulfilled | shipped | completed | cancelled
    tracking_number: Optional[str] = None
    notes: Optional[str] = None


@api.post("/orders/create")
async def create_order(payload: OrderCreate, user: dict = Depends(get_current_user)):
    """Create an order draft with shipping address. Caller must follow with /checkout/session for payment."""
    if not payload.items:
        raise HTTPException(400, "No items in cart")
    total = 0.0; currency = "usd"
    enriched_items = []
    for it in payload.items:
        product = await db.products.find_one({"id": it["product_id"]})
        if not product:
            raise HTTPException(404, f"Product not found: {it['product_id']}")
        qty = int(it.get("quantity", 1))
        if qty < 1:
            raise HTTPException(400, f"Invalid quantity for {product['title']}")
        stock = int(product.get("stock_qty", 0) or 0)
        if stock < qty:
            raise HTTPException(400, f"'{product['title']}' is out of stock (only {stock} left)")
        line_total = product["price"] * qty
        total += line_total
        currency = product.get("currency", "usd")
        enriched_items.append({
            "product_id": product["id"], "title": product["title"],
            "quantity": qty, "unit_price": product["price"],
            "variant": it.get("variant"), "line_total": line_total,
        })
    order = {
        "id": gen_id(),
        "user_id": user["id"],
        "user_email": user["email"],
        "items": enriched_items,
        "shipping_address": payload.shipping_address.model_dump(),
        "notes": payload.notes,
        "total": round(total, 2),
        "currency": currency,
        "status": "pending",
        "tracking_number": None,
        "created_at": now_utc().isoformat(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    return order


@api.get("/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    return await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["user_id"] != user["id"] and user.get("role") not in ("admin", "support"):
        raise HTTPException(403, "Forbidden")
    return order


@api.get("/admin/orders")
async def list_all_orders(request: Request, status: Optional[str] = None):
    await require_role(request, ["admin", "support"])
    q = {"status": status} if status else {}
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/orders/status")
async def update_order_status(payload: OrderStatusUpdate, request: Request):
    await require_role(request, ["admin", "support"])
    valid = ["pending", "paid", "fulfilled", "shipped", "completed", "cancelled"]
    if payload.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of {valid}")
    update = {"status": payload.status, "updated_at": now_utc().isoformat()}
    if payload.tracking_number:
        update["tracking_number"] = payload.tracking_number
    if payload.notes:
        update["admin_notes"] = payload.notes
    r = await db.orders.update_one({"id": payload.order_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Order not found")
    return {"ok": True}
