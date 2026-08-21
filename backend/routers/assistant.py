"""Tony's virtual assistant — homepage chat (+ browser voice on the client).

Uses the Emergent universal key via emergentintegrations (Claude Sonnet 4.6).
Captures leads and hands hot leads off to WhatsApp via a wa.me deep link.
"""
import os
import base64
import tempfile
from typing import Optional, List
from urllib.parse import quote
from dotenv import load_dotenv
from fastapi import Request, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, EmailStr

from core import api, db, gen_id, now_utc, logger, require_role, get_optional_user
from routers.settings import get_setting

load_dotenv()
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
ASSISTANT_MODEL = ("anthropic", "claude-sonnet-4-6")

PERSONA = (
    "You are the friendly virtual assistant for Tony Sanchez Yoga, a world-class yoga teacher "
    "with ~50 years of experience. Your tone is calm, warm, encouraging and concise (2-4 sentences). "
    "Help visitors choose the right offering and, when they show interest, gently collect their name, "
    "email and phone/WhatsApp so Tony's team can follow up. Never invent prices, dates or facts that "
    "aren't in the catalog below. If unsure, suggest talking to Tony on WhatsApp. Recommend the best-fit "
    "program (Core 20 for beginners, Core 40 to progress, Core 84 Asana Mastery for advanced), a live "
    "class, or the shop. Keep replies mobile-friendly."
)


class ChatIn(BaseModel):
    session_id: Optional[str] = None
    message: str


class LeadIn(BaseModel):
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    channel: Optional[str] = "whatsapp"
    goal: Optional[str] = None
    interest: Optional[str] = None


async def _catalog_text() -> str:
    progs = await db.programs.find({}, {"_id": 0, "title": 1, "level": 1, "price": 1, "price_model": 1, "description": 1}).to_list(50)
    lines = ["COURSES:"]
    for p in progs:
        price = "free" if p.get("price_model") == "free" else (f"€{round(p.get('price', 0))}" + (" (or with membership)" if p.get("price_model") == "membership" else " one-time"))
        desc = (p.get("description") or "")[:110]
        lines.append(f"- {p.get('title')} ({p.get('level')}, {price}): {desc}")
    bundles = await db.bundles.find({"active": True}, {"_id": 0, "title": 1, "price": 1}).to_list(20)
    for b in bundles:
        lines.append(f"- BUNDLE {b.get('title')}: €{round(b.get('price', 0))}")
    lines.append("Also: live Zoom classes (Schedule), class passes & memberships, and a shop (books, mats, posters).")
    return "\n".join(lines)


@api.get("/assistant/config")
async def assistant_config():
    return {
        "enabled": (await get_setting("assistant_enabled")) is not False,
        "greeting": (await get_setting("assistant_greeting")) or "Hi, I'm Tony's assistant. How can I help you find the right yoga path today?",
        "popup_delay": int((await get_setting("assistant_popup_delay")) or 8),
        "whatsapp": (await get_setting("social_whatsapp")) or "",
    }


@api.post("/assistant/chat")
async def assistant_chat(payload: ChatIn, user: Optional[dict] = Depends(get_optional_user)):
    if (await get_setting("assistant_enabled")) is False:
        raise HTTPException(403, "Assistant is disabled.")
    msg = (payload.message or "").strip()
    if not msg:
        raise HTTPException(400, "Empty message.")
    sid, reply_text = await _generate_reply(payload.session_id, msg, user)
    return {"session_id": sid, "reply": reply_text}


async def _generate_reply(session_id: Optional[str], msg: str, user: Optional[dict]) -> tuple:
    """Shared assistant brain used by both text chat and voice. Returns (session_id, reply)."""
    sid = session_id or gen_id()
    session = await db.chatbot_sessions.find_one({"id": sid}, {"_id": 0})
    history: List[dict] = (session or {}).get("messages", [])

    reply_text = "I'm here to help! Could you tell me a bit about your goals — flexibility, stress relief, or building strength?"
    if EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
            system = PERSONA + "\n\n" + await _catalog_text()
            convo = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in history[-8:])
            prompt = (f"Conversation so far:\n{convo}\n\n" if convo else "") + f"VISITOR: {msg}\n\nReply as the assistant:"
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"assist-{sid}", system_message=system).with_model(*ASSISTANT_MODEL)
            resp = await chat.send_message(UserMessage(text=prompt))
            reply_text = str(resp).strip() or reply_text
        except Exception as e:
            logger.warning(f"assistant chat failed: {e}")

    now = now_utc().isoformat()
    new_msgs = history + [
        {"role": "visitor", "text": msg, "at": now},
        {"role": "assistant", "text": reply_text, "at": now},
    ]
    await db.chatbot_sessions.update_one(
        {"id": sid},
        {"$set": {"messages": new_msgs[-40:], "updated_at": now, "user_id": (user or {}).get("id")},
         "$setOnInsert": {"id": sid, "created_at": now}},
        upsert=True,
    )
    return sid, reply_text


async def _tts_base64(text: str, voice: str = "nova") -> str:
    """Synthesize spoken audio (mp3) as base64 via the Emergent key. '' on failure."""
    if not EMERGENT_LLM_KEY or not text.strip():
        return ""
    try:
        from emergentintegrations.llm.openai import OpenAITextToSpeech  # type: ignore
        tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
        return await tts.generate_speech_base64(text=text[:900], voice=voice, response_format="mp3")
    except Exception as e:
        logger.warning(f"assistant TTS failed: {e}")
        return ""


class TTSIn(BaseModel):
    text: str
    voice: Optional[str] = "nova"


@api.post("/assistant/tts")
async def assistant_tts(payload: TTSIn):
    if (await get_setting("assistant_enabled")) is False:
        raise HTTPException(403, "Assistant is disabled.")
    audio = await _tts_base64(payload.text or "", payload.voice or "nova")
    return {"audio_base64": audio, "mime": "audio/mpeg"}


@api.post("/assistant/voice")
async def assistant_voice(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    speak: Optional[bool] = Form(True),
    user: Optional[dict] = Depends(get_optional_user),
):
    """Voice turn: transcribe mic audio (Whisper), get an assistant reply, and
    return spoken audio (OpenAI TTS)."""
    if (await get_setting("assistant_enabled")) is False:
        raise HTTPException(403, "Assistant is disabled.")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Voice is not available right now.")
    raw = await audio.read()
    if not raw:
        raise HTTPException(400, "Empty audio.")
    # Whisper needs a file with a recognised extension; browsers send webm/ogg.
    suffix = ".webm"
    name = (audio.filename or "").lower()
    for ext in (".webm", ".mp3", ".m4a", ".wav", ".mp4", ".ogg"):
        if name.endswith(ext):
            suffix = ".ogg" if ext == ".ogg" else ext
            break
    transcript = ""
    tmp_path = None
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText  # type: ignore
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
            tf.write(raw)
            tmp_path = tf.name
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        with open(tmp_path, "rb") as f:
            resp = await stt.transcribe(file=f, model="whisper-1", response_format="text")
        transcript = (resp if isinstance(resp, str) else getattr(resp, "text", "")).strip()
    except Exception as e:
        logger.warning(f"assistant STT failed: {e}")
        raise HTTPException(502, "Could not understand the audio. Please try again.")
    finally:
        if tmp_path:
            try: os.unlink(tmp_path)
            except Exception: pass

    if not transcript:
        raise HTTPException(400, "No speech detected.")
    sid, reply_text = await _generate_reply(session_id, transcript, user)
    audio_b64 = await _tts_base64(reply_text) if speak else ""
    return {"session_id": sid, "transcript": transcript, "reply": reply_text,
            "audio_base64": audio_b64, "mime": "audio/mpeg"}


@api.post("/assistant/lead")
async def assistant_lead(payload: LeadIn, user: Optional[dict] = Depends(get_optional_user)):
    if not (payload.name or payload.email or payload.phone):
        raise HTTPException(400, "Please share at least a name and a way to reach you.")
    now = now_utc().isoformat()
    lead = {
        "id": gen_id(),
        "session_id": payload.session_id,
        "user_id": (user or {}).get("id"),
        "name": payload.name, "email": payload.email, "phone": payload.phone,
        "channel": payload.channel or "whatsapp",
        "goal": payload.goal, "interest": payload.interest,
        "status": "new", "created_at": now,
    }
    await db.ai_leads.insert_one(lead)
    if payload.session_id:
        await db.chatbot_sessions.update_one({"id": payload.session_id}, {"$set": {"lead_id": lead["id"], "captured": True}})

    # Best-effort acknowledgment email to the enquirer (no-op if SMTP disabled).
    if payload.email:
        try:
            from email_service import send_enquiry_ack
            await send_enquiry_ack(payload.email, payload.name, payload.interest)
        except Exception as e:
            logger.warning(f"enquiry ack email failed for {payload.email}: {e}")

    wa_number = (await get_setting("social_whatsapp")) or ""
    digits = "".join(ch for ch in wa_number if ch.isdigit())
    wa_url = ""
    if digits:
        text = quote(f"Hi Tony! I'm {payload.name or 'a new student'} and I'm interested in {payload.interest or 'your yoga courses'}.")
        wa_url = f"https://wa.me/{digits}?text={text}"
    lead.pop("_id", None)
    return {"ok": True, "lead_id": lead["id"], "whatsapp_url": wa_url}


@api.get("/admin/assistant/leads")
async def admin_assistant_leads(request: Request):
    await require_role(request, ["admin"])
    rows = await db.ai_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"leads": rows, "total": len(rows)}


@api.get("/admin/assistant/leads/export.csv")
async def export_leads_csv(request: Request):
    """CSV of captured AI-assistant leads for CRM / Google Sheet import. Admin-only."""
    import io
    import csv
    from fastapi.responses import Response
    await require_role(request, ["admin"])
    rows = await db.ai_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["name", "email", "phone", "channel", "goal", "interest", "status", "created_at"])
    for r in rows:
        writer.writerow([
            r.get("name", ""), r.get("email", ""), r.get("phone", ""), r.get("channel", ""),
            r.get("goal", ""), r.get("interest", ""), r.get("status", ""), r.get("created_at", ""),
        ])
    return Response(
        content=buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ai_leads.csv"'},
    )
