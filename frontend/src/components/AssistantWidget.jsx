import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/api";

export default function AssistantWidget() {
  const [cfg, setCfg] = useState(null);
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("ty_assistant_dismissed") === "1");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", interest: "" });
  const [leadSent, setLeadSent] = useState(false);
  const [waUrl, setWaUrl] = useState("");
  const [showLead, setShowLead] = useState(false);
  const scrollRef = useRef(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => { api.get("/assistant/config").then(({ data }) => setCfg(data)).catch(() => setCfg(false)); }, []);

  useEffect(() => {
    if (!cfg || cfg.enabled === false || dismissed) return;
    const t = setTimeout(() => { if (!open) setTeaser(true); }, (cfg.popup_delay || 8) * 1000);
    return () => clearTimeout(t);
  }, [cfg, dismissed, open]);

  useEffect(() => {
    if (open && msgs.length === 0 && cfg?.greeting) setMsgs([{ role: "assistant", text: cfg.greeting }]);
  }, [open, cfg, msgs.length]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [msgs, showLead]);

  const playB64 = (b64) => {
    if (!b64) return;
    try {
      const src = `data:audio/mpeg;base64,${b64}`;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = src;
      audioRef.current.play().catch(() => {});
    } catch { /* noop */ }
  };

  // Read a text reply aloud using server-side OpenAI TTS (higher quality, cross-browser).
  const speak = async (text) => {
    if (!speakOn || !text) return;
    try {
      const { data } = await api.post("/assistant/tts", { text });
      playB64(data.audio_base64);
    } catch { /* noop */ }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput(""); setMsgs((m) => [...m, { role: "visitor", text: content }]); setSending(true);
    try {
      const { data } = await api.post("/assistant/chat", { session_id: sessionId, message: content });
      setSessionId(data.session_id);
      setMsgs((m) => [...m, { role: "assistant", text: data.reply }]);
      speak(data.reply);
      if (msgs.length >= 3) setShowLead(true);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Sorry, I had trouble replying. You can reach Tony's team on WhatsApp anytime." }]);
    } finally { setSending(false); }
  };

  const stopTracks = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    streamRef.current = null;
  };

  // Voice turn: record mic audio, send to Whisper, get a spoken reply back.
  const toggleMic = async () => {
    if (listening) { try { mediaRecRef.current?.stop(); } catch { /* noop */ } return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        setListening(false); stopTracks();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return;
        setVoiceBusy(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          if (sessionId) fd.append("session_id", sessionId);
          fd.append("speak", "true");
          const { data } = await api.post("/assistant/voice", fd, { headers: { "Content-Type": "multipart/form-data" } });
          setSessionId(data.session_id);
          setMsgs((m) => [...m, { role: "visitor", text: data.transcript }, { role: "assistant", text: data.reply }]);
          playB64(data.audio_base64);
          if (msgs.length >= 2) setShowLead(true);
        } catch {
          setMsgs((m) => [...m, { role: "assistant", text: "I couldn't catch that — try again, or type your question." }]);
        } finally { setVoiceBusy(false); }
      };
      rec.start();
      setListening(true);
    } catch { setListening(false); stopTracks(); }
  };

  const submitLead = async () => {
    if (!lead.name && !lead.email && !lead.phone) return;
    try {
      const { data } = await api.post("/assistant/lead", { session_id: sessionId, ...lead });
      setLeadSent(true); setWaUrl(data.whatsapp_url || "");
      setMsgs((m) => [...m, { role: "assistant", text: `Thanks ${lead.name || "so much"}! Tony's team will reach out. You can also message us directly on WhatsApp below.` }]);
    } catch { /* noop */ }
  };

  const close = () => { setOpen(false); setTeaser(false); setDismissed(true); sessionStorage.setItem("ty_assistant_dismissed", "1"); };

  if (!cfg || cfg.enabled === false) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3" data-testid="assistant-widget">
      <AnimatePresence>
        {teaser && !open && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => { setOpen(true); setTeaser(false); }}
            data-testid="assistant-teaser"
            className="max-w-[240px] rounded-2xl bg-white shadow-xl border border-[#E5E6DF] px-4 py-3 text-left text-sm text-[#1C221F]"
          >
            {cfg.greeting}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-[92vw] max-w-[380px] h-[70vh] max-h-[560px] rounded-3xl bg-[#FAFAF7] shadow-2xl border border-[#E5E6DF] flex flex-col overflow-hidden"
            data-testid="assistant-panel"
          >
            <div className="flex items-center justify-between bg-[#1C221F] text-[#FAFAF7] px-4 py-3">
              <div>
                <div className="text-[13px] font-semibold">Tony's Assistant</div>
                <div className="text-[10px] text-white/60">Here to guide your practice</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSpeakOn((v) => !v)} data-testid="assistant-speak-toggle" title="Read replies aloud" className="p-1.5 rounded-full hover:bg-white/10">
                  {speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-white/60" />}
                </button>
                <button onClick={close} data-testid="assistant-close" className="p-1.5 rounded-full hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "visitor" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === "visitor" ? "bg-[#B25A45] text-white" : "bg-white border border-[#E5E6DF] text-[#1C221F]"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && <div className="text-[11px] text-[#839682] pl-1">typing…</div>}

              {showLead && !leadSent && (
                <div className="rounded-2xl bg-white border border-[#E5E6DF] p-3 space-y-2" data-testid="assistant-lead-form">
                  <div className="text-[11px] uppercase tracking-widest font-bold text-[#B25A45]">Get personalised help</div>
                  <input data-testid="assistant-lead-name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Your name" className="w-full rounded-xl border border-[#E5E6DF] px-3 py-2 text-sm" />
                  <input data-testid="assistant-lead-email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="Email" className="w-full rounded-xl border border-[#E5E6DF] px-3 py-2 text-sm" />
                  <input data-testid="assistant-lead-phone" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="Phone / WhatsApp" className="w-full rounded-xl border border-[#E5E6DF] px-3 py-2 text-sm" />
                  <button onClick={submitLead} data-testid="assistant-lead-submit" className="pill pill-primary w-full !py-2 !text-xs">Send my details</button>
                </div>
              )}

              {leadSent && waUrl && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" data-testid="assistant-whatsapp" className="pill w-full !py-2.5 !text-xs !bg-[#25D366] !text-white justify-center">
                  <MessageCircle className="h-4 w-4" /> Chat with Tony on WhatsApp
                </a>
              )}
            </div>

            <div className="border-t border-[#E5E6DF] p-3 flex items-center gap-2 bg-white">
              <button onClick={toggleMic} disabled={voiceBusy} data-testid="assistant-mic" title={listening ? "Tap to stop" : "Speak to Tony's assistant"} className={`p-2 rounded-full ${listening ? "bg-[#B25A45] text-white animate-pulse" : "bg-[#F2F2EC] text-[#6B7269]"} disabled:opacity-50`}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                data-testid="assistant-input" placeholder={voiceBusy ? "Listening…" : listening ? "Recording… tap mic to send" : "Ask about courses, classes…"}
                className="flex-1 rounded-full border border-[#E5E6DF] px-4 py-2 text-sm focus:outline-none focus:border-[#B25A45]"
              />
              <button onClick={() => send()} disabled={sending} data-testid="assistant-send" className="p-2 rounded-full bg-[#B25A45] text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => { setOpen(true); setTeaser(false); }}
          data-testid="assistant-launcher"
          className="h-14 w-14 rounded-full bg-[#B25A45] text-white shadow-xl flex items-center justify-center"
          aria-label="Open Tony's assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </motion.button>
      )}
    </div>
  );
}
