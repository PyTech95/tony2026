"""Workshop retreat reservations with €500 deposit + balance payment."""
import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from core import api, db, now_utc, gen_id, get_current_user

DEPOSIT_EUR = float(os.environ.get("RETREAT_DEPOSIT_EUR", "500"))
BALANCE_DUE_DAYS_BEFORE = int(os.environ.get("RETREAT_BALANCE_DUE_DAYS_BEFORE", "30"))


class RetreatReserve(BaseModel):
    workshop_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    yoga_status: str = "Perpetual Yogi"
    years_of_practice: int = 0
    notes: Optional[str] = None
    wants_teacher_training: bool = False


def _balance_due_date(workshop: dict) -> str:
    start = datetime.fromisoformat(str(workshop["start_date"]).replace("Z", "+00:00"))
    due = start - timedelta(days=BALANCE_DUE_DAYS_BEFORE)
    return due.isoformat()


@api.post("/retreats/reserve")
async def reserve_retreat(payload: RetreatReserve, user: dict = Depends(get_current_user)):
    workshop = await db.workshops.find_one({"id": payload.workshop_id})
    if not workshop:
        raise HTTPException(404, "Retreat not found")

    active = await db.workshop_registrations.count_documents(
        {"workshop_id": payload.workshop_id, "status": {"$in": ["deposit_paid", "paid_in_full", "pending_deposit"]}}
    )
    if active >= workshop.get("capacity", 14):
        raise HTTPException(400, "Retreat full")

    existing = await db.workshop_registrations.find_one(
        {"user_id": user["id"], "workshop_id": payload.workshop_id, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    )
    if existing:
        return existing

    price = float(workshop.get("price_eur", 1600.0))
    deposit = float(workshop.get("deposit_eur") or DEPOSIT_EUR)
    tt_upgrade = float(workshop.get("teacher_training_price_eur") or 0) if payload.wants_teacher_training else 0
    total = price + tt_upgrade
    balance = max(0.0, total - deposit)

    doc = {
        "id": gen_id(),
        "user_id": user["id"],
        "workshop_id": payload.workshop_id,
        "workshop_title": workshop.get("title"),
        "workshop_start_date": workshop.get("start_date"),
        "name": payload.name,
        "email": str(payload.email).lower(),
        "phone": payload.phone,
        "yoga_status": payload.yoga_status,
        "years_of_practice": payload.years_of_practice,
        "wants_teacher_training": payload.wants_teacher_training,
        "notes": payload.notes,
        "total_eur": round(total, 2),
        "deposit_eur": deposit,
        "balance_eur": round(balance, 2),
        "balance_due_date": _balance_due_date(workshop),
        "status": "pending_deposit",
        "deposit_paid_at": None,
        "balance_paid_at": None,
        "created_at": now_utc().isoformat(),
    }
    await db.workshop_registrations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/retreats/mine")
async def my_retreats(user: dict = Depends(get_current_user)):
    rows = await db.workshop_registrations.find(
        {"user_id": user["id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return rows


@api.get("/retreats/{reservation_id}")
async def get_reservation(reservation_id: str, user: dict = Depends(get_current_user)):
    doc = await db.workshop_registrations.find_one({"id": reservation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Reservation not found")
    if doc["user_id"] != user["id"] and user.get("role") not in ("admin", "support"):
        raise HTTPException(403, "Forbidden")
    return doc


# ---------- Balance reminders (called from server.py background loop) ----------
import logging
_logger = logging.getLogger("tony-yoga.retreats")


async def send_balance_reminders_tick():
    """Send a push + email reminder 7 days before balance_due_date for reservations
    still in 'deposit_paid' state. Idempotent via `balance_reminder_sent_at`."""
    now = now_utc()
    window_end = now + timedelta(days=7, minutes=1)
    window_start = now + timedelta(days=7, minutes=-1)
    # Idempotency: we only look at reservations whose balance_due_date lands in a
    # small window around "now + 7 days" AND haven't yet been reminded.
    pending = await db.workshop_registrations.find(
        {
            "status": "deposit_paid",
            "balance_due_date": {"$gte": window_start.isoformat(), "$lte": window_end.isoformat()},
            "balance_reminder_sent_at": {"$exists": False},
        },
        {"_id": 0},
    ).to_list(200)
    total_sent = 0
    for r in pending:
        try:
            # Push
            from routers.push import _send_one
            subs = await db.push_subscriptions.find({"user_id": r["user_id"], "active": True}, {"_id": 0}).to_list(10)
            due = str(r.get("balance_due_date", ""))[:10]
            payload = {
                "title": f"Balance due in 7 days · €{int(r.get('balance_eur', 0))}",
                "body": f"Your {r.get('workshop_title', 'retreat')} balance is due {due}. Tap to pay.",
                "url": "/profile",
            }
            for s in subs:
                if _send_one(s, payload):
                    total_sent += 1
            # Email
            from email_service import send_email
            html = (
                f"<h3>Your balance for {r.get('workshop_title')}</h3>"
                f"<p>Just a gentle reminder — your remaining <strong>€{int(r.get('balance_eur', 0))}</strong> "
                f"is due on <strong>{due}</strong>. You can pay in-app under Profile · Your retreats.</p>"
                f"<p>See you on the mat.<br/>— Tony</p>"
            )
            if r.get("email"):
                await send_email(r["email"], f"Balance due · {r.get('workshop_title')}", html)
        except Exception as e:
            _logger.warning(f"balance reminder send failed for {r.get('id')}: {e}")
        await db.workshop_registrations.update_one(
            {"id": r["id"]},
            {"$set": {"balance_reminder_sent_at": now.isoformat()}},
        )

    # Due-now reminder: email the moment the balance becomes due (30 days before the
    # retreat), idempotent via `balance_due_now_sent_at`.
    due_now = await db.workshop_registrations.find(
        {
            "status": "deposit_paid",
            "balance_due_date": {"$lte": now.isoformat()},
            "balance_due_now_sent_at": {"$exists": False},
        },
        {"_id": 0},
    ).to_list(200)
    for r in due_now:
        try:
            from email_service import send_email
            due = str(r.get("balance_due_date", ""))[:10]
            html = (
                f"<h3>Balance now due · {r.get('workshop_title')}</h3>"
                f"<p>Your remaining balance of <strong>€{int(r.get('balance_eur', 0))}</strong> is now due "
                f"(as of <strong>{due}</strong>). Please complete payment in-app under Profile · Your retreats "
                f"to keep your seat.</p>"
                f"<p>With gratitude,<br/>— Tony</p>"
            )
            if r.get("email"):
                await send_email(r["email"], f"Balance now due · {r.get('workshop_title')}", html)
        except Exception as e:
            _logger.warning(f"balance due-now reminder failed for {r.get('id')}: {e}")
        await db.workshop_registrations.update_one(
            {"id": r["id"]},
            {"$set": {"balance_due_now_sent_at": now.isoformat()}},
        )

    if pending:
        _logger.info(f"balance reminders: notified {len(pending)} reservation(s)")
    return len(pending) + len(due_now)
