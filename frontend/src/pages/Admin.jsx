import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Calendar, TrendingUp, Send, Check, X, CreditCard, Mail, Bell, Save, RefreshCw, History, BookOpen, Plus, ArrowLeft, Trash2, ChevronUp, ChevronDown, Youtube, Play, Clock, Eye, EyeOff, ListPlus, Instagram, Wallet, ClipboardCheck, Package, GraduationCap, Award, MessageCircle, Video, Mic } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Navigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import { parseYouTubeId, isYouTube, secToMMSS, mmssToSec, youTubeThumb } from "@/lib/youtube";

function Tab({ active, onClick, children, tid }) {
  return (
    <button
      onClick={onClick}
      data-testid={tid}
      className={`pill !py-2 !px-4 !text-[13px] ${active ? "pill-primary" : "pill-ghost"}`}
    >
      {children}
    </button>
  );
}

function RevenueTrend() {
  const [trend, setTrend] = useState(null);
  useEffect(() => { api.get("/admin/stats/trend").then(({ data }) => setTrend(data.trend || [])).catch(() => setTrend([])); }, []);
  if (trend === null) return null;
  const hasRevenue = trend.some((d) => d.revenue > 0);
  const hasMembers = trend.some((d) => d.members > 0);
  return (
    <div className="space-y-4" data-testid="admin-revenue-trend">
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
        <div className="flex items-center gap-2 text-[#B25A45] mb-3"><TrendingUp className="h-4 w-4" /><span className="eyebrow !text-[10px]">Revenue · last 6 months</span></div>
        {!hasRevenue ? (
          <p className="text-xs text-[#6B7269] py-8 text-center">No paid transactions yet — your revenue trend will appear here.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trend} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B25A45" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#B25A45" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFE8" vertical={false} />
              <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fill: "#839682" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E5E6DF", fontSize: 12 }}
                formatter={(v) => [`$${v}`, "Revenue"]}
                cursor={{ stroke: "#B25A45", strokeOpacity: 0.2 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#B25A45" strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
        <div className="flex items-center gap-2 text-[#839682] mb-3"><Users className="h-4 w-4" /><span className="eyebrow !text-[10px]">New members · last 6 months</span></div>
        {!hasMembers ? (
          <p className="text-xs text-[#6B7269] py-8 text-center">New sign-ups will chart here as members join.</p>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={trend} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFE8" vertical={false} />
              <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fill: "#839682" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5E6DF", fontSize: 12 }} formatter={(v) => [v, "New members"]} cursor={{ fill: "rgba(131,150,130,0.08)" }} />
              <Bar dataKey="members" fill="#839682" radius={[6, 6, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DashboardHome() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setD(data)).catch(() => setD(false)); }, []);
  if (d === null || d === false) return null;
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return ""; } };
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; } };
  const card = "rounded-2xl bg-white border border-[#E5E6DF] p-4";
  return (
    <div className="space-y-4" data-testid="admin-dashboard">
      {/* Hero metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className={card} data-testid="dash-month-revenue">
          <div className="flex items-center gap-2 text-[#B25A45]"><TrendingUp className="h-4 w-4" /><span className="eyebrow !text-[10px]">{d.month_label} revenue</span></div>
          <div className="serif text-2xl mt-1.5">€{Math.round(d.month_revenue)}</div>
        </div>
        <div className={card} data-testid="dash-today-count">
          <div className="flex items-center gap-2 text-[#839682]"><Calendar className="h-4 w-4" /><span className="eyebrow !text-[10px]">Today's classes</span></div>
          <div className="serif text-2xl mt-1.5">{d.today_count}</div>
        </div>
        <div className={card} data-testid="dash-signups">
          <div className="flex items-center gap-2 text-[#B25A45]"><Users className="h-4 w-4" /><span className="eyebrow !text-[10px]">New · 7 days</span></div>
          <div className="serif text-2xl mt-1.5">{d.signups_7d}</div>
        </div>
      </div>

      {/* Today's classes */}
      <div className={card} data-testid="dash-today-classes">
        <div className="flex items-center gap-2 text-[#B25A45] mb-3"><Clock className="h-4 w-4" /><span className="eyebrow !text-[11px]">Today's schedule</span></div>
        {d.today.length === 0 ? (
          <p className="text-sm text-[#6B7269] py-2">No classes scheduled today.</p>
        ) : (
          <ul className="space-y-2">
            {d.today.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#F7F7F2] px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{c.title}</div>
                  <div className="text-[11px] text-[#6B7269]">{fmtTime(c.start_time)} · {c.location_type}</div>
                </div>
                <div className="text-[12px] font-semibold text-[#545E56] shrink-0">{c.booked}/{c.capacity} booked</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Recent signups */}
        <div className={card} data-testid="dash-recent-signups">
          <div className="flex items-center gap-2 text-[#839682] mb-3"><Users className="h-4 w-4" /><span className="eyebrow !text-[11px]">Recent signups</span></div>
          {d.recent_signups.length === 0 ? (
            <p className="text-sm text-[#6B7269] py-2">No signups in the last 7 days.</p>
          ) : (
            <ul className="space-y-2">
              {d.recent_signups.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-[#6B7269] truncate">{u.email} · {u.role}</div>
                  </div>
                  <span className="text-[11px] text-[#6B7269] shrink-0">{fmtDate(u.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent payments */}
        <div className={card} data-testid="dash-recent-payments">
          <div className="flex items-center gap-2 text-[#B25A45] mb-3"><TrendingUp className="h-4 w-4" /><span className="eyebrow !text-[11px]">Recent payments</span></div>
          {d.recent_payments.length === 0 ? (
            <p className="text-sm text-[#6B7269] py-2">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {d.recent_payments.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate capitalize">{(p.item_type || "purchase").replace(/_/g, " ")}</div>
                    <div className="text-[11px] text-[#6B7269] truncate">{p.user_email} · {p.provider}</div>
                  </div>
                  <span className="text-[13px] font-semibold text-[#545E56] shrink-0">{p.currency === "EUR" ? "€" : ""}{Math.round(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsPane() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => setStats(false)); }, []);
  if (stats === null) return <Spinner />;
  if (stats === false) return <p className="text-sm text-[#6B7269]">Could not load stats.</p>;
  const cells = [
    { label: "Users", v: stats.users, i: <Users className="h-4 w-4" /> },
    { label: "Students", v: stats.students, i: <Users className="h-4 w-4" /> },
    { label: "Bookings", v: stats.bookings, i: <Calendar className="h-4 w-4" /> },
    { label: "Active subs", v: stats.active_subscriptions, i: <TrendingUp className="h-4 w-4" /> },
    { label: "Revenue", v: `$${stats.revenue}`, i: <TrendingUp className="h-4 w-4" /> },
    { label: "Transactions", v: stats.transactions, i: <TrendingUp className="h-4 w-4" /> },
  ];
  return (
    <div className="space-y-4">
      <DashboardHome />
      <div className="grid grid-cols-2 gap-3" data-testid="admin-stats">
        {cells.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
            <div className="flex items-center gap-2 text-[#B25A45]">{c.i}<span className="eyebrow !text-[10px]">{c.label}</span></div>
            <div className="serif text-2xl mt-2">{c.v}</div>
          </div>
        ))}
      </div>
      <RevenueTrend />
    </div>
  );
}

function ClassRecordingForm({ instance, onDone }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);

  const createMeeting = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/class-instances/${instance.id}/zoom-meeting`);
      toast.success(data.zoom_mock ? "Mock Zoom meeting created (add keys in Settings for real ones)." : "Zoom meeting created.");
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not create meeting"); }
    finally { setBusy(false); }
  };

  const attach = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/class-instances/${instance.id}/recording`, { recording_url: url || undefined, replay_days: Number(days) || 3 });
      toast.success("Recording attached.");
      setOpen(false); setUrl("");
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not attach recording"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/class-instances/${instance.id}/recording`);
      toast.success("Recording removed.");
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not remove"); }
    finally { setBusy(false); }
  };

  const hasRec = !!instance.recording_expires_at;
  return (
    <div className="mt-3 pt-3 border-t border-[#EEEFE8] space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {instance.location_type === "online" && (
          instance.zoom_join_url
            ? <span className="text-[#839682] font-semibold" data-testid={`zoom-set-${instance.id}`}>Zoom link ✓{instance.zoom_mock ? " (mock)" : ""}</span>
            : <button onClick={createMeeting} disabled={busy} data-testid={`zoom-create-${instance.id}`} className="text-[#2D8CFF] hover:underline font-semibold">Create Zoom meeting</button>
        )}
        {hasRec ? (
          <span className="text-[#545E56]" data-testid={`rec-set-${instance.id}`}>
            · Recording set · expires {new Date(instance.recording_expires_at).toLocaleDateString()}
            <button onClick={remove} disabled={busy} data-testid={`rec-remove-${instance.id}`} className="ml-2 text-[#B25A45] hover:underline">Remove</button>
          </span>
        ) : (
          <button onClick={() => setOpen((o) => !o)} data-testid={`rec-add-${instance.id}`} className="text-[#B25A45] hover:underline font-semibold">· Add recording</button>
        )}
      </div>
      {open && !hasRec && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Recording URL (leave blank to pull from Zoom)"
            data-testid={`rec-url-${instance.id}`}
            className="flex-1 rounded-xl border border-[#E5E6DF] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]"
          />
          <input
            type="number" min={1} max={60} value={days}
            onChange={(e) => setDays(e.target.value)}
            data-testid={`rec-days-${instance.id}`}
            className="w-20 rounded-xl border border-[#E5E6DF] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]"
            title="Replay days"
          />
          <button onClick={attach} disabled={busy} data-testid={`rec-save-${instance.id}`} className="pill pill-primary !py-2 !px-4 !text-[13px]">Save</button>
        </div>
      )}
    </div>
  );
}

function ClassesPane() {
  const [instances, setInstances] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/class-instances?upcoming=true&include_cancelled=true"); setInstances(data); }
    catch { setInstances([]); }
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!window.confirm("Cancel this class? This will also cancel all bookings.")) return;
    try {
      await api.patch(`/admin/class-instances/${id}`, { status: "cancelled" });
      toast.success("Class cancelled.");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not cancel"); }
  };

  if (instances === null) return <Spinner />;
  return (
    <ul className="space-y-2" data-testid="admin-classes-list">
      {instances.map((c) => (
        <li key={c.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold truncate">{c.title}</div>
              <div className="text-xs text-[#6B7269] mt-0.5">{new Date(c.start_time).toLocaleString()}</div>
              <div className="text-[11px] mt-1.5 text-[#545E56]">{c.bookings_count || 0} / {c.capacity} booked · {c.location_type}</div>
              <div className="text-[10px] mt-1 uppercase tracking-widest font-semibold" style={{ color: c.status === "cancelled" ? "#B25A45" : "#839682" }}>{c.status}</div>
            </div>
            {c.status !== "cancelled" && (
              <button onClick={() => cancel(c.id)} data-testid={`admin-cancel-${c.id}`} className="text-xs text-[#B25A45] hover:underline shrink-0">Cancel</button>
            )}
          </div>
          {c.status !== "cancelled" && <ClassRecordingForm instance={c} onDone={load} />}
        </li>
      ))}
    </ul>
  );
}

function ApplicationsPane() {
  const [apps, setApps] = useState(null);
  const load = async () => {
    try { const { data } = await api.get("/admin/instructor-applications"); setApps(data); }
    catch { setApps([]); }
  };
  useEffect(() => { load(); }, []);

  const decide = async (id, action) => {
    try {
      await api.post("/admin/instructor-applications/decision", { application_id: id, action });
      toast.success(`Application ${action}d.`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  if (apps === null) return <Spinner />;
  if (apps.length === 0) return <p className="text-sm text-[#6B7269] py-8 text-center">No applications yet.</p>;

  return (
    <ul className="space-y-3" data-testid="admin-apps-list">
      {apps.map((a) => (
        <li key={a.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{a.name}</div>
              <div className="text-xs text-[#6B7269] mt-0.5">{a.email} · {a.years_experience}yr</div>
              <div className="text-xs mt-1 text-[#545E56]">{(a.styles || []).join(", ")}</div>
              <p className="text-xs text-[#6B7269] mt-2 clamp-3 leading-relaxed">{a.bio}</p>
              <div className="text-[10px] mt-2 uppercase tracking-widest font-semibold" style={{ color: a.status === "pending" ? "#B25A45" : "#839682" }}>{a.status}</div>
            </div>
            {a.status === "pending" && (
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => decide(a.id, "approve")} data-testid={`admin-approve-${a.id}`} className="pill pill-primary !py-1.5 !px-3 !text-xs"><Check className="h-3 w-3" /> Approve</button>
                <button onClick={() => decide(a.id, "reject")} data-testid={`admin-reject-${a.id}`} className="pill pill-ghost !py-1.5 !px-3 !text-xs"><X className="h-3 w-3" /> Reject</button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function EpisodesManager() {
  const [eps, setEps] = useState(null);
  const empty = { title: "", description: "", media_type: "audio", media_url: "", cover_image: "", tags: "", series: "", publish_at: "", notify_push: true };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    try { const { data } = await api.get("/admin/broadcasts"); setEps(data); } catch { setEps([]); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim() || !form.media_url.trim()) { toast.error("Title and media URL are required."); return; }
    setBusy(true);
    try {
      const payload = {
        title: form.title, description: form.description, media_type: form.media_type,
        media_url: form.media_url, cover_image: form.cover_image || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        series: form.series || undefined,
        publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : undefined,
        notify_push: form.notify_push,
      };
      await api.post("/admin/broadcasts", payload);
      toast.success(form.publish_at && new Date(form.publish_at) > new Date() ? "Episode scheduled." : "Episode published.");
      setForm(empty); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not save"); }
    finally { setBusy(false); }
  };

  const publishNow = async (id) => {
    try { await api.post(`/admin/broadcasts/${id}/publish`); toast.success("Published."); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const del = async (id) => {
    if (!window.confirm("Delete this episode?")) return;
    try { await api.delete(`/admin/broadcasts/${id}`); toast.success("Deleted."); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-4" data-testid="admin-episode-form">
        <div className="flex items-center gap-2 text-[#B25A45]"><Mic className="h-4 w-4" /><span className="eyebrow !text-[11px]">New episode</span></div>
        <Field label="Title"><input data-testid="episode-title" className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Breath & the nervous system" /></Field>
        <Field label="Type">
          <div className="flex gap-2">
            {["audio", "video"].map((m) => (
              <button key={m} type="button" onClick={() => set("media_type", m)} data-testid={`episode-type-${m}`}
                className={`pill !py-2 !px-4 !text-[13px] ${form.media_type === m ? "pill-primary" : "pill-ghost"}`}>{m === "audio" ? "Audio" : "Video"}</button>
            ))}
          </div>
        </Field>
        <Field label="Media URL" hint="YouTube link for video, or a direct .mp3/.mp4 URL.">
          <input data-testid="episode-url" className={inputCls} value={form.media_url} onChange={(e) => set("media_url", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Description"><textarea data-testid="episode-desc" rows={2} className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Cover image URL (optional)"><input data-testid="episode-cover" className={inputCls} value={form.cover_image} onChange={(e) => set("cover_image", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Tags (comma-separated)"><input data-testid="episode-tags" className={inputCls} value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="philosophy, beginner" /></Field>
        </div>
        <Field label="Series / season (optional)" hint="Group episodes into a themed run, e.g. 'Foundations of Breath'.">
          <input data-testid="episode-series" className={inputCls} value={form.series} onChange={(e) => set("series", e.target.value)} placeholder="Series name" />
        </Field>
        <Field label="Schedule release (optional)" hint="Leave blank to publish immediately. Future time auto-publishes later.">
          <input data-testid="episode-schedule" type="datetime-local" className={inputCls} value={form.publish_at} onChange={(e) => set("publish_at", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-[#545E56]">
          <input type="checkbox" data-testid="episode-notify" checked={form.notify_push} onChange={(e) => set("notify_push", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
          Notify subscribers with a push when it goes live
        </label>
        <button onClick={create} disabled={busy} data-testid="episode-save" className="pill pill-primary w-full"><Plus className="h-4 w-4" /> {busy ? "Saving…" : "Save episode"}</button>
      </div>

      {eps === null ? <Spinner /> : eps.length === 0 ? (
        <p className="text-sm text-[#6B7269] py-4 text-center">No episodes yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="admin-episodes-list">
          {eps.map((ep) => {
            const scheduled = !ep.is_published;
            return (
              <li key={ep.id} data-testid={`episode-row-${ep.id}`} className="rounded-2xl bg-white border border-[#E5E6DF] p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold truncate">{ep.title}</div>
                  <div className="text-[11px] text-[#6B7269] mt-0.5 uppercase tracking-widest">{ep.media_type} · {scheduled ? `scheduled ${new Date(ep.publish_at).toLocaleString()}` : `live ${new Date(ep.publish_at).toLocaleDateString()}`}</div>
                </div>
                {scheduled && <button onClick={() => publishNow(ep.id)} data-testid={`episode-publish-${ep.id}`} className="pill pill-ghost !py-1.5 !px-3 !text-xs">Publish now</button>}
                <button onClick={() => del(ep.id)} data-testid={`episode-delete-${ep.id}`} className="text-[#B25A45] hover:text-[#8f4436] shrink-0"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BroadcastPane() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await api.post("/admin/push/broadcast", { title, body, audience });
      toast.success(`Sent to ${data.sent} device${data.sent === 1 ? "" : "s"}.`);
      setTitle(""); setBody("");
    } catch (e) { toast.error(e?.response?.data?.detail || "Broadcast failed"); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-2">Podcast & talks</div>
        <EpisodesManager />
      </div>
      <div>
        <div className="eyebrow mb-2">Send push notification</div>
        <form onSubmit={send} className="rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-3">
          <input
            data-testid="admin-broadcast-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Title"
            className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]"
          />
          <textarea
            data-testid="admin-broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={3}
            placeholder="Message"
            className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]"
          />
          <div className="flex gap-2">
            {["all", "members"].map((a) => (
              <button key={a} type="button" onClick={() => setAudience(a)} data-testid={`admin-broadcast-audience-${a}`} className={`pill !py-2 !px-4 !text-[13px] ${audience === a ? "pill-primary" : "pill-ghost"}`}>
                {a === "all" ? "Everyone" : "Members only"}
              </button>
            ))}
          </div>
          <button type="submit" disabled={sending} data-testid="admin-broadcast-send" className="pill pill-primary w-full">
            <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send push"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest font-semibold text-[#839682] mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-[#6B7269] mt-1">{hint}</div>}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-[#E5E6DF] px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]";

function Toggle({ checked, onChange, tid }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      data-testid={tid}
      role="switch"
      aria-checked={checked}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#B25A45]" : "bg-[#D8D9D1]"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function SettingsPane() {
  const [s, setS] = useState(null);      // raw settings (for display flags)
  const [form, setForm] = useState({});  // editable values
  const [init, setInit] = useState({});  // snapshot to compute dirty fields
  const [audit, setAudit] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [genning, setGenning] = useState(false);
  const [verifyingPaypal, setVerifyingPaypal] = useState(false);
  const [syncingIg, setSyncingIg] = useState(false);
  const [verifyingZoom, setVerifyingZoom] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [waTo, setWaTo] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/admin/settings");
      setS(data);
      const next = {
        stripe_enabled: !!data.stripe_enabled,
        stripe_mode: data.stripe_mode || "test",
        stripe_publishable_key: data.stripe_publishable_key || "",
        stripe_secret_key: "",
        stripe_webhook_secret: "",
        paypal_enabled: !!data.paypal_enabled,
        paypal_mode: data.paypal_mode || "sandbox",
        paypal_client_id: data.paypal_client_id || "",
        paypal_client_secret: "",
        email_enabled: !!data.email_enabled,
        smtp_host: data.smtp_host || "smtp.gmail.com",
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || "",
        smtp_password: "",
        sender_email: data.sender_email || "",
        sender_name: data.sender_name || "Tony Yoga",
        push_enabled: !!data.push_enabled,
        vapid_claim_email: data.vapid_claim_email || "",
        reminder_lead_minutes: data.reminder_lead_minutes ?? 30,
        reels_enabled: data.reels_enabled !== false,
        social_instagram: data.social_instagram || "",
        instagram_reels: Array.isArray(data.instagram_reels) ? data.instagram_reels : [],
        instagram_auto_sync: !!data.instagram_auto_sync,
        instagram_user_id: data.instagram_user_id || "",
        instagram_access_token: "",
        assistant_enabled: data.assistant_enabled !== false,
        assistant_greeting: data.assistant_greeting || "",
        assistant_popup_delay: data.assistant_popup_delay ?? 8,
        social_whatsapp: data.social_whatsapp || "",
        zoom_enabled: !!data.zoom_enabled,
        zoom_account_id: data.zoom_account_id || "",
        zoom_client_id: data.zoom_client_id || "",
        zoom_client_secret: "",
        zoom_host_user_id: data.zoom_host_user_id || "",
        recording_replay_days: data.recording_replay_days ?? 3,
        whatsapp_enabled: !!data.whatsapp_enabled,
        twilio_account_sid: data.twilio_account_sid || "",
        twilio_auth_token: "",
        twilio_whatsapp_from: data.twilio_whatsapp_from || "",
      };
      setForm(next);
      setInit(next);
      api.get("/admin/settings/audit").then(({ data: a }) => setAudit(a || [])).catch(() => {});
    } catch { setS(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ---- Instagram reels editor helpers ----
  const extractShortcode = (raw) => {
    const v = (raw || "").trim();
    const m = v.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i);
    return m ? m[1] : v.replace(/\/+$/, "");
  };
  const addReel = () => setForm((f) => ({ ...f, instagram_reels: [...(f.instagram_reels || []), { shortcode: "", caption: "" }] }));
  const removeReel = (idx) => setForm((f) => ({ ...f, instagram_reels: (f.instagram_reels || []).filter((_, i) => i !== idx) }));
  const updateReel = (idx, key, value) => setForm((f) => ({
    ...f,
    instagram_reels: (f.instagram_reels || []).map((r, i) =>
      i === idx ? { ...r, [key]: key === "shortcode" ? extractShortcode(value) : value } : r
    ),
  }));

  const save = async () => {
    setSaving(true);
    try {
      // Only send fields the admin actually changed — avoids persisting
      // env-derived values (e.g. publishable key) into the DB and shadowing env.
      const payload = {};
      Object.keys(form).forEach((k) => {
        if (form[k] === init[k]) return;
        if (k === "smtp_port") payload[k] = Number(form[k]) || 587;
        else if (k === "reminder_lead_minutes") payload[k] = Number(form[k]) || 30;
        else payload[k] = form[k];
      });
      // Never send blank secrets.
      ["stripe_secret_key", "stripe_webhook_secret", "smtp_password", "paypal_client_secret", "instagram_access_token", "zoom_client_secret", "twilio_auth_token"].forEach((k) => {
        if (!payload[k]) delete payload[k];
      });
      if (Object.keys(payload).length === 0) { toast.info("No changes to save."); setSaving(false); return; }
      const { data } = await api.patch("/admin/settings", payload);
      toast.success("Settings saved.");
      (data.warnings || []).forEach((w) => (toast.warning ? toast.warning(w) : toast(w)));
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const clearSecret = async (key) => {
    if (!window.confirm("Clear this saved secret? Checkout/email that relies on it will stop working until you enter a new value.")) return;
    try {
      await api.patch("/admin/settings", { [key]: "__clear__" });
      toast.success("Secret cleared.");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not clear"); }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/admin/email/test", { to: testTo || undefined });
      if (data.ok) toast.success(`Test email sent to ${data.to}`);
      else toast.error(data.error || "Send failed");
    } catch (e) { toast.error(e?.response?.data?.detail || "Send failed"); }
    finally { setTesting(false); }
  };

  const generateVapid = async () => {
    if (s.vapid_public_key && !window.confirm("Regenerate VAPID keys? Existing push subscriptions will stop working and students will need to re-enable reminders.")) return;
    setGenning(true);
    try {
      await api.post("/admin/push/generate-vapid");
      toast.success("VAPID keys generated — web push is on.");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Generation failed"); }
    finally { setGenning(false); }
  };

  const verifyPaypal = async () => {
    setVerifyingPaypal(true);
    try {
      const { data } = await api.post("/admin/paypal/verify");
      if (data.ok) toast.success(data.message || "PayPal connected.");
      else toast.error(data.error || "PayPal verification failed.");
    } catch (e) { toast.error(e?.response?.data?.detail || "Verification failed"); }
    finally { setVerifyingPaypal(false); }
  };

  const syncInstagram = async () => {
    setSyncingIg(true);
    try {
      const { data } = await api.post("/admin/instagram/sync");
      toast.success(`Synced ${data.count} reel${data.count === 1 ? "" : "s"} from Instagram.`);
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Sync failed — check the access token & account id."); }
    finally { setSyncingIg(false); }
  };

  const verifyZoom = async () => {
    setVerifyingZoom(true);
    try {
      const { data } = await api.post("/admin/zoom/verify");
      if (data.ok) toast.success(data.message || "Zoom connected.");
      else toast.error(data.error || "Zoom verification failed.");
    } catch (e) { toast.error(e?.response?.data?.detail || "Verification failed"); }
    finally { setVerifyingZoom(false); }
  };

  const testWhatsapp = async () => {
    setTestingWa(true);
    try {
      const { data } = await api.post("/admin/whatsapp/test", { to: waTo });
      if (data.ok) toast.success(`Test WhatsApp sent to ${data.to}`);
      else toast.error(data.error || "Send failed");
    } catch (e) { toast.error(e?.response?.data?.detail || "Send failed"); }
    finally { setTestingWa(false); }
  };

  if (s === null) return <Spinner />;
  if (s === false) return <p className="text-sm text-[#6B7269]">Could not load settings.</p>;

  const card = "rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-4";
  const secretHint = (key) =>
    s[`${key}_set`]
      ? (s[`${key}_from_env`] ? "Configured from server env. Enter a value to override." : "Configured. Leave blank to keep current.")
      : "Not set.";

  return (
    <div className="space-y-4" data-testid="admin-settings">
      {/* -------- Payments / Stripe -------- */}
      <div className={card} data-testid="settings-payments-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#B25A45]"><CreditCard className="h-4 w-4" /><span className="eyebrow !text-[11px]">Payments · Stripe</span></div>
          <Toggle checked={form.stripe_enabled} onChange={(v) => set("stripe_enabled", v)} tid="settings-stripe-enabled" />
        </div>
        <Field label="Mode" hint="Use test keys while trying it out; switch to live for real charges.">
          <div className="flex gap-2">
            {["test", "live"].map((m) => (
              <button key={m} type="button" onClick={() => set("stripe_mode", m)} data-testid={`settings-stripe-mode-${m}`}
                className={`pill !py-2 !px-4 !text-[13px] ${form.stripe_mode === m ? "pill-primary" : "pill-ghost"}`}>
                {m === "test" ? "Test" : "Live"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Publishable key" hint="Starts with pk_live_ or pk_test_.">
          <input data-testid="settings-stripe-pk" className={inputCls} value={form.stripe_publishable_key}
            onChange={(e) => set("stripe_publishable_key", e.target.value)} placeholder="pk_live_..." />
        </Field>
        <Field label="Secret key" hint={secretHint("stripe_secret_key") + " Starts with sk_live_ or sk_test_."}>
          <input data-testid="settings-stripe-sk" type="password" className={inputCls} value={form.stripe_secret_key}
            onChange={(e) => set("stripe_secret_key", e.target.value)} placeholder={s.stripe_secret_key_set ? "•••• configured" : "sk_live_..."} />
          {s.stripe_secret_key_set && !s.stripe_secret_key_from_env && <button type="button" onClick={() => clearSecret("stripe_secret_key")} data-testid="clear-stripe-sk" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved key</button>}
        </Field>
        <Field label="Webhook signing secret" hint={secretHint("stripe_webhook_secret") + " From your Stripe webhook endpoint."}>
          <input data-testid="settings-stripe-whsec" type="password" className={inputCls} value={form.stripe_webhook_secret}
            onChange={(e) => set("stripe_webhook_secret", e.target.value)} placeholder={s.stripe_webhook_secret_set ? "•••• configured" : "whsec_..."} />
          {s.stripe_webhook_secret_set && !s.stripe_webhook_secret_from_env && <button type="button" onClick={() => clearSecret("stripe_webhook_secret")} data-testid="clear-stripe-whsec" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved key</button>}
        </Field>
      </div>

      {/* -------- Zoom (live classes + recordings) -------- */}
      <div className={card} data-testid="settings-zoom-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#2D8CFF]"><Video className="h-4 w-4" /><span className="eyebrow !text-[11px]">Live classes · Zoom</span></div>
          <Toggle checked={form.zoom_enabled} onChange={(v) => set("zoom_enabled", v)} tid="settings-zoom-enabled" />
        </div>
        <p className="text-[12px] text-[#6B7269] -mt-1">Server-to-Server OAuth. When configured, new online classes auto-create a Zoom meeting. Leave blank to use safe mock links for testing.</p>
        <Field label="Account ID" hint="From your Zoom Server-to-Server OAuth app.">
          <input data-testid="settings-zoom-account" className={inputCls} value={form.zoom_account_id}
            onChange={(e) => set("zoom_account_id", e.target.value)} placeholder="Account ID" />
        </Field>
        <Field label="Client ID">
          <input data-testid="settings-zoom-client-id" className={inputCls} value={form.zoom_client_id}
            onChange={(e) => set("zoom_client_id", e.target.value)} placeholder="Client ID" />
        </Field>
        <Field label="Client Secret" hint={secretHint("zoom_client_secret")}>
          <input data-testid="settings-zoom-secret" type="password" className={inputCls} value={form.zoom_client_secret}
            onChange={(e) => set("zoom_client_secret", e.target.value)} placeholder={s.zoom_client_secret_set ? "•••• configured" : "Client Secret"} />
          {s.zoom_client_secret_set && !s.zoom_client_secret_from_env && <button type="button" onClick={() => clearSecret("zoom_client_secret")} data-testid="clear-zoom-secret" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved secret</button>}
        </Field>
        <Field label="Host user" hint="Licensed Zoom user email or id that owns the meetings.">
          <input data-testid="settings-zoom-host" className={inputCls} value={form.zoom_host_user_id}
            onChange={(e) => set("zoom_host_user_id", e.target.value)} placeholder="tony@tonyyoga.com" />
        </Field>
        <Field label="Default replay window (days)" hint="How long class recordings stay watchable after the class.">
          <input data-testid="settings-zoom-replay-days" type="number" min={1} max={60} className={inputCls}
            value={form.recording_replay_days} onChange={(e) => set("recording_replay_days", Number(e.target.value) || 3)} />
        </Field>
        <button type="button" onClick={verifyZoom} disabled={verifyingZoom} data-testid="settings-zoom-verify" className="pill pill-ghost !py-2 !px-4 !text-[13px]">
          {verifyingZoom ? "Verifying…" : "Verify connection"}
        </button>
      </div>

      {/* -------- WhatsApp (Twilio) -------- */}
      <div className={card} data-testid="settings-whatsapp-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#25D366]"><MessageCircle className="h-4 w-4" /><span className="eyebrow !text-[11px]">Notifications · WhatsApp</span></div>
          <Toggle checked={form.whatsapp_enabled} onChange={(v) => set("whatsapp_enabled", v)} tid="settings-whatsapp-enabled" />
        </div>
        <p className="text-[12px] text-[#6B7269] -mt-1">Twilio WhatsApp. When on and configured, class reminders and new episodes are also sent over WhatsApp to members who have a number on file.</p>
        <Field label="Account SID" hint="From your Twilio Console.">
          <input data-testid="settings-twilio-sid" className={inputCls} value={form.twilio_account_sid} onChange={(e) => set("twilio_account_sid", e.target.value)} placeholder="ACxxxxxxxx" />
        </Field>
        <Field label="Auth Token" hint={secretHint("twilio_auth_token")}>
          <input data-testid="settings-twilio-token" type="password" className={inputCls} value={form.twilio_auth_token} onChange={(e) => set("twilio_auth_token", e.target.value)} placeholder={s.twilio_auth_token_set ? "•••• configured" : "Auth token"} />
          {s.twilio_auth_token_set && !s.twilio_auth_token_from_env && <button type="button" onClick={() => clearSecret("twilio_auth_token")} data-testid="clear-twilio-token" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved token</button>}
        </Field>
        <Field label="WhatsApp From number" hint="e.g. whatsapp:+14155238886 (Twilio sandbox) or your approved sender.">
          <input data-testid="settings-twilio-from" className={inputCls} value={form.twilio_whatsapp_from} onChange={(e) => set("twilio_whatsapp_from", e.target.value)} placeholder="whatsapp:+14155238886" />
        </Field>
        <div className="flex gap-2">
          <input data-testid="settings-whatsapp-testto" className={inputCls + " flex-1"} value={waTo} onChange={(e) => setWaTo(e.target.value)} placeholder="+34600123456" />
          <button type="button" onClick={testWhatsapp} disabled={testingWa} data-testid="settings-whatsapp-test" className="pill pill-ghost !py-2 !px-4 !text-[13px] shrink-0">{testingWa ? "Sending…" : "Send test"}</button>
        </div>
      </div>

      {/* -------- Payments / PayPal (primary) -------- */}
      <div className={card} data-testid="settings-paypal-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#003087]"><Wallet className="h-4 w-4" /><span className="eyebrow !text-[11px]">Payments · PayPal <span className="text-[#B25A45]">(primary)</span></span></div>
          <Toggle checked={form.paypal_enabled} onChange={(v) => set("paypal_enabled", v)} tid="settings-paypal-enabled" />
        </div>
        <p className="text-[12px] text-[#6B7269] -mt-1">When on and configured, PayPal is shown first at every checkout. Card (Stripe) stays available as a backup.</p>
        <Field label="Environment" hint="Use Sandbox to test with fake money; switch to Live for real payments.">
          <div className="flex gap-2">
            {["sandbox", "live"].map((m) => (
              <button key={m} type="button" onClick={() => set("paypal_mode", m)} data-testid={`settings-paypal-mode-${m}`}
                className={`pill !py-2 !px-4 !text-[13px] ${form.paypal_mode === m ? "pill-primary" : "pill-ghost"}`}>
                {m === "sandbox" ? "Sandbox" : "Live"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Client ID" hint="From your PayPal Developer app (REST API app).">
          <input data-testid="settings-paypal-client-id" className={inputCls} value={form.paypal_client_id}
            onChange={(e) => set("paypal_client_id", e.target.value)} placeholder="AXxx…" />
        </Field>
        <Field label="Client secret" hint={secretHint("paypal_client_secret")}>
          <input data-testid="settings-paypal-secret" type="password" className={inputCls} value={form.paypal_client_secret}
            onChange={(e) => set("paypal_client_secret", e.target.value)} placeholder={s.paypal_client_secret_set ? "•••• configured" : "EXxxx…"} />
          {s.paypal_client_secret_set && !s.paypal_client_secret_from_env && <button type="button" onClick={() => clearSecret("paypal_client_secret")} data-testid="clear-paypal-secret" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved secret</button>}
        </Field>
        <button type="button" onClick={verifyPaypal} disabled={verifyingPaypal} data-testid="settings-paypal-verify" className="pill pill-ghost">
          <RefreshCw className="h-4 w-4" /> {verifyingPaypal ? "Checking…" : "Verify connection"}
        </button>
        <p className="text-[11px] text-[#6B7269]">Get keys at <span className="font-semibold">developer.paypal.com → Apps &amp; Credentials</span>. Match the Sandbox/Live keys to the environment selected above. Save first, then Verify.</p>
      </div>

      {/* -------- Email / SMTP -------- */}
      <div className={card} data-testid="settings-email-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#B25A45]"><Mail className="h-4 w-4" /><span className="eyebrow !text-[11px]">Email · SMTP</span></div>
          <Toggle checked={form.email_enabled} onChange={(v) => set("email_enabled", v)} tid="settings-email-enabled" />
        </div>
        <p className="text-[12px] text-[#6B7269] -mt-1">When on, students get a confirmation email each time they book a class.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SMTP host"><input data-testid="settings-smtp-host" className={inputCls} value={form.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" /></Field>
          <Field label="Port"><input data-testid="settings-smtp-port" className={inputCls} value={form.smtp_port} onChange={(e) => set("smtp_port", e.target.value)} placeholder="587" /></Field>
        </div>
        <Field label="SMTP username" hint="Usually the full email address."><input data-testid="settings-smtp-user" className={inputCls} value={form.smtp_user} onChange={(e) => set("smtp_user", e.target.value)} placeholder="you@gmail.com" /></Field>
        <Field label="SMTP password / app password" hint={secretHint("smtp_password")}>
          <input data-testid="settings-smtp-pass" type="password" className={inputCls} value={form.smtp_password} onChange={(e) => set("smtp_password", e.target.value)} placeholder={s.smtp_password_set ? "•••• configured" : "app password"} />
          {s.smtp_password_set && !s.smtp_password_from_env && <button type="button" onClick={() => clearSecret("smtp_password")} data-testid="clear-smtp-pass" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved password</button>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sender email"><input data-testid="settings-sender-email" className={inputCls} value={form.sender_email} onChange={(e) => set("sender_email", e.target.value)} placeholder="tony@tonysanchezyoga.com" /></Field>
          <Field label="Sender name"><input data-testid="settings-sender-name" className={inputCls} value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} placeholder="Tony Yoga" /></Field>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input data-testid="settings-test-email-to" className={inputCls} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send test to (defaults to your email)" />
          <button type="button" onClick={sendTest} disabled={testing} data-testid="settings-send-test-email" className="pill pill-ghost shrink-0"><Send className="h-4 w-4" /> {testing ? "Sending…" : "Send test"}</button>
        </div>
      </div>

      {/* -------- Push / VAPID -------- */}
      <div className={card} data-testid="settings-push-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#B25A45]"><Bell className="h-4 w-4" /><span className="eyebrow !text-[11px]">Class reminders · Web Push</span></div>
          <Toggle checked={form.push_enabled} onChange={(v) => set("push_enabled", v)} tid="settings-push-enabled" />
        </div>
        <p className="text-[12px] text-[#6B7269] -mt-1">When on, students who opt in get a push nudge {form.reminder_lead_minutes || 30} minutes before class.</p>
        <Field label="VAPID public key" hint={s.vapid_public_key ? "Keys are configured." : "No keys yet — generate a keypair to enable push."}>
          <input data-testid="settings-vapid-public" readOnly className={inputCls + " bg-[#F7F7F2] text-[#6B7269]"} value={s.vapid_public_key || ""} placeholder="Not generated" />
        </Field>
        <Field label="Contact email (VAPID claim)"><input data-testid="settings-vapid-email" className={inputCls} value={form.vapid_claim_email} onChange={(e) => set("vapid_claim_email", e.target.value)} placeholder="mailto:tony@tonysanchezyoga.com" /></Field>
        <Field label="Reminder timing" hint="How many minutes before a class the reminder push is sent.">
          <div className="flex items-center gap-2">
            <input data-testid="settings-reminder-lead" type="number" min="5" max="240" className={inputCls + " max-w-[120px]"} value={form.reminder_lead_minutes} onChange={(e) => set("reminder_lead_minutes", e.target.value)} />
            <span className="text-sm text-[#6B7269]">minutes before class</span>
          </div>
        </Field>
        <button type="button" onClick={generateVapid} disabled={genning} data-testid="settings-generate-vapid" className="pill pill-ghost">
          <RefreshCw className="h-4 w-4" /> {genning ? "Generating…" : (s.vapid_public_key ? "Regenerate keys" : "Generate keys")}
        </button>
      </div>

      {/* -------- Instagram feed -------- */}
      <div className={card} data-testid="settings-instagram-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#B25A45]"><Instagram className="h-4 w-4" /><span className="eyebrow !text-[11px]">Instagram feed · Homepage</span></div>
          <Toggle checked={form.reels_enabled} onChange={(v) => set("reels_enabled", v)} tid="settings-reels-enabled" />
        </div>
        <p className="text-[12px] text-[#6B7269] -mt-1">Controls the “Fresh from the mat” reels section on the homepage. Turn off to hide it entirely.</p>
        <Field label="Instagram profile URL" hint="Used by the “Follow on Instagram” links.">
          <input data-testid="settings-instagram-handle" className={inputCls} value={form.social_instagram}
            onChange={(e) => set("social_instagram", e.target.value)} placeholder="https://www.instagram.com/tonyoga_school/" />
        </Field>

        {/* Auto-sync via Meta Graph API */}
        <div className="rounded-2xl bg-[#F7F7F2] border border-[#E5E6DF] p-4 space-y-3" data-testid="settings-instagram-autosync">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-[#839682]">Auto-sync latest reels</span>
            <Toggle checked={form.instagram_auto_sync} onChange={(v) => set("instagram_auto_sync", v)} tid="settings-ig-autosync-toggle" />
          </div>
          <p className="text-[11px] text-[#6B7269] -mt-1">Pulls the latest reels automatically every ~30 min using the Instagram Graph API. Needs a Business/Creator account, its account id, and a long-lived access token.</p>
          <Field label="Instagram account id">
            <input data-testid="settings-ig-user-id" className={inputCls} value={form.instagram_user_id} onChange={(e) => set("instagram_user_id", e.target.value)} placeholder="17841400000000000" />
          </Field>
          <Field label="Access token (long-lived)" hint={secretHint("instagram_access_token")}>
            <input data-testid="settings-ig-token" type="password" className={inputCls} value={form.instagram_access_token} onChange={(e) => set("instagram_access_token", e.target.value)} placeholder={s.instagram_access_token_set ? "•••• configured" : "IGQVJ…"} />
            {s.instagram_access_token_set && !s.instagram_access_token_from_env && <button type="button" onClick={() => clearSecret("instagram_access_token")} data-testid="clear-ig-token" className="text-[11px] text-[#B25A45] hover:underline mt-1">Clear saved token</button>}
          </Field>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={syncInstagram} disabled={syncingIg} data-testid="settings-ig-sync-now" className="pill pill-primary !py-1.5 !px-3 !text-xs"><RefreshCw className="h-3.5 w-3.5" /> {syncingIg ? "Syncing…" : "Sync now"}</button>
            {s.instagram_last_sync && <span className="text-[11px] text-[#6B7269]">Last synced {new Date(s.instagram_last_sync).toLocaleString()}</span>}
          </div>
          {s.instagram_last_error && <p className="text-[11px] text-[#B25A45]">Last error: {s.instagram_last_error}</p>}
          <p className="text-[11px] text-[#6B7269]">Tip: save the token first, then “Sync now”. Synced reels fill the list below automatically.</p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-[#839682]">Reels shown (first 4)</div>
          {(form.instagram_reels || []).length === 0 && (
            <p className="text-[12px] text-[#6B7269]">No reels added — a curated default set is shown until you add your own.</p>
          )}
          <ul className="space-y-2" data-testid="settings-reels-list">
            {(form.instagram_reels || []).map((r, idx) => (
              <li key={idx} className="rounded-2xl bg-[#F7F7F2] border border-[#E5E6DF] p-3 space-y-2" data-testid={`settings-reel-row-${idx}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#839682]">Reel {idx + 1}</span>
                  <button type="button" onClick={() => removeReel(idx)} data-testid={`settings-reel-remove-${idx}`} className="text-[#B25A45] hover:text-[#8f4436]"><Trash2 className="h-4 w-4" /></button>
                </div>
                <input data-testid={`settings-reel-shortcode-${idx}`} className={inputCls} value={r.shortcode || ""}
                  onChange={(e) => updateReel(idx, "shortcode", e.target.value)} placeholder="Paste Instagram reel link or shortcode (e.g. C_2wKtGRJJP)" />
                <input data-testid={`settings-reel-caption-${idx}`} className={inputCls} value={r.caption || ""}
                  onChange={(e) => updateReel(idx, "caption", e.target.value)} placeholder="Caption (optional)" />
              </li>
            ))}
          </ul>
          <button type="button" onClick={addReel} data-testid="settings-reel-add" className="pill pill-ghost !py-1.5 !px-3 !text-xs"><Plus className="h-3.5 w-3.5" /> Add reel</button>
        </div>
      </div>

      {/* -------- AI Assistant -------- */}
      <AssistantCard form={form} set={set} inputCls={inputCls} card={card} />

      {/* -------- Audit log -------- */}
      <div className={card} data-testid="settings-audit-card">
        <div className="flex items-center gap-2 text-[#B25A45]"><History className="h-4 w-4" /><span className="eyebrow !text-[11px]">Change history</span></div>
        <p className="text-[12px] text-[#6B7269] -mt-1">Who changed settings and when. Secret values are never recorded — only which keys changed.</p>
        {audit.length === 0 ? (
          <p className="text-sm text-[#6B7269] py-2">No changes recorded yet.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto" data-testid="settings-audit-list">
            {audit.map((a, i) => (
              <li key={i} className="rounded-xl bg-[#F7F7F2] border border-[#E5E6DF] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold truncate">{a.admin_email || a.admin_id || "admin"}</span>
                  <span className="text-[11px] text-[#6B7269] shrink-0">{new Date(a.at).toLocaleString()}</span>
                </div>
                <div className="text-[12px] text-[#545E56] mt-1">
                  Changed: {(a.keys || []).join(", ")}
                  {(a.secret_changed || []).length > 0 && <span className="text-[#B25A45]"> · incl. secret{a.secret_changed.length > 1 ? "s" : ""}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" onClick={save} disabled={saving} data-testid="settings-save" className="pill pill-primary w-full sticky bottom-3">
        <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save all settings"}
      </button>
    </div>
  );
}

function ImportPane() {
  const [memberBatch, setMemberBatch] = useState("");
  const [memberFile, setMemberFile] = useState(null);
  const [classFile, setClassFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);

  const importMembers = async () => {
    if (!memberFile) return toast.error("Choose a members CSV first.");
    setBusy("members");
    try {
      const fd = new FormData();
      fd.append("batch_name", memberBatch || "CSV import");
      fd.append("file", memberFile);
      const { data } = await api.post("/admin/legacy/import-csv", fd);
      setResult({ kind: "members", msg: `${data.batch?.valid_records ?? 0} members imported/invited.` });
      toast.success("Members imported.");
    } catch (e) { toast.error(e?.response?.data?.detail || "Import failed"); }
    finally { setBusy(""); }
  };

  const importClasses = async () => {
    if (!classFile) return toast.error("Choose a classes CSV first.");
    setBusy("classes");
    try {
      const fd = new FormData();
      fd.append("file", classFile);
      const { data } = await api.post("/admin/class-instances/import-csv", fd);
      setResult({ kind: "classes", msg: `${data.created} classes created.`, errors: data.errors || [] });
      toast.success(`${data.created} classes created.`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Import failed"); }
    finally { setBusy(""); }
  };

  const card = "rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-3";
  const fileCls = "block w-full text-sm text-[#545E56] file:mr-3 file:rounded-full file:border-0 file:bg-[#F2F2EC] file:px-4 file:py-2 file:text-[#1C221F] file:font-semibold";
  return (
    <div className="space-y-4" data-testid="admin-import">
      <div className={card}>
        <div className="flex items-center gap-2 text-[#B25A45]"><Users className="h-4 w-4" /><span className="eyebrow !text-[11px]">Import members</span></div>
        <p className="text-[12px] text-[#6B7269] -mt-1">CSV with an <b>email</b> column (optional <b>name</b>). Each gets an account + invite link.</p>
        <input data-testid="import-members-batch" className={inputCls} value={memberBatch} onChange={(e) => setMemberBatch(e.target.value)} placeholder="Batch name (e.g. Squarespace export)" />
        <input data-testid="import-members-file" type="file" accept=".csv" onChange={(e) => setMemberFile(e.target.files?.[0] || null)} className={fileCls} />
        <button type="button" onClick={importMembers} disabled={busy === "members"} data-testid="import-members-btn" className="pill pill-primary w-full">{busy === "members" ? "Importing…" : "Import members"}</button>
      </div>
      <div className={card}>
        <div className="flex items-center gap-2 text-[#B25A45]"><Calendar className="h-4 w-4" /><span className="eyebrow !text-[11px]">Import classes</span></div>
        <p className="text-[12px] text-[#6B7269] -mt-1">CSV columns: <b>title, start_time</b> (ISO e.g. 2026-09-01T08:00:00), duration_minutes, capacity, location_type, location_detail, style, level.</p>
        <input data-testid="import-classes-file" type="file" accept=".csv" onChange={(e) => setClassFile(e.target.files?.[0] || null)} className={fileCls} />
        <button type="button" onClick={importClasses} disabled={busy === "classes"} data-testid="import-classes-btn" className="pill pill-primary w-full">{busy === "classes" ? "Importing…" : "Import classes"}</button>
      </div>
      {result && (
        <div className="rounded-2xl bg-[#F2F2EC] border border-[#E5E6DF] p-4" data-testid="import-result">
          <div className="text-sm font-semibold">{result.msg}</div>
          {result.errors?.length > 0 && (
            <ul className="mt-2 text-[12px] text-[#B25A45] space-y-0.5">
              {result.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LessonsEditor({ programId }) {
  const [lessons, setLessons] = useState(null);
  const [form, setForm] = useState(null); // single lesson { id?, title, youtube_url, start, end, is_free_preview, is_private }
  const [bulk, setBulk] = useState(null); // bulk mode { youtube_url, text, free_preview_first, is_private }
  const [busy, setBusy] = useState(false);
  const lc = "w-full rounded-2xl border border-[#E5E6DF] px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]";

  const load = async () => {
    try { const { data } = await api.get(`/admin/programs/${programId}/lessons`); setLessons(data); }
    catch { setLessons([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [programId]);

  const openNew = () => { setBulk(null); setForm({ title: "", youtube_url: "", start: "0:00", end: "", is_free_preview: false, is_private: false, requires_submission: false, assignment_prompt: "", pass_threshold: 60, max_attempts: 0 }); };
  const openBulk = () => { setForm(null); setBulk({ youtube_url: "", text: "0:00 Intro & warm-up\n10:00 Standing series\n22:30 Floor series\n40:00 Final relaxation", free_preview_first: true, is_private: false }); };
  const openEdit = (l) => {
    setBulk(null);
    setForm({
      id: l.id,
      title: l.video?.title || "",
      youtube_url: l.video?.source_url || l.video?.video_url || "",
      start: secToMMSS(l.video?.start_seconds || 0),
      end: l.video?.end_seconds ? secToMMSS(l.video.end_seconds) : "",
      is_free_preview: !!l.is_free_preview,
      is_private: !!l.video?.is_private,
      requires_submission: !!l.requires_submission,
      assignment_prompt: l.assignment_prompt || "",
      pass_threshold: l.pass_threshold ?? 60,
      max_attempts: l.max_attempts ?? 0,
    });
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setB = (k, v) => setBulk((b) => ({ ...b, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Lesson title is required.");
    if (!parseYouTubeId(form.youtube_url)) return toast.error("Enter a valid YouTube link.");
    const start = mmssToSec(form.start) || 0;
    const end = form.end ? mmssToSec(form.end) : null;
    if (end != null && end <= start) return toast.error("End time must be after start time.");
    setBusy(true);
    const body = { title: form.title.trim(), youtube_url: form.youtube_url.trim(), start_seconds: start, end_seconds: end, is_free_preview: form.is_free_preview, is_private: form.is_private, requires_submission: !!form.requires_submission, assignment_prompt: form.requires_submission ? (form.assignment_prompt || "") : "", pass_threshold: Number(form.pass_threshold) || 60, max_attempts: Math.max(0, Number(form.max_attempts) || 0) };
    try {
      if (form.id) { await api.patch(`/admin/lessons/${form.id}`, body); toast.success("Lesson updated."); }
      else { await api.post(`/admin/programs/${programId}/lessons`, body); toast.success("Lesson added."); }
      setForm(null); await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const parseChapters = (text) => (text || "").split("\n").map((line) => {
    const raw = line.trim();
    if (!raw) return null;
    // Detect a timestamp token (mm:ss or h:mm:ss), possibly wrapped in ()/[]
    const tm = raw.match(/(?:^|[\s(\[])(\d{1,2}:\d{2}(?::\d{2})?)(?:[\s)\]]|$)/);
    if (!tm) return null;
    const ts = tm[1];
    const title = raw
      .replace(/[([]?\d{1,2}:\d{2}(?::\d{2})?[)\]]?/, "")
      .replace(/^[\s\-–—.·|:]+/, "")
      .replace(/[\s\-–—.·|:]+$/, "")
      .trim();
    if (!title) return null;
    return { start_seconds: mmssToSec(ts) || 0, title };
  }).filter(Boolean);

  const saveBulk = async () => {
    if (!parseYouTubeId(bulk.youtube_url)) return toast.error("Enter a valid YouTube link.");
    const chapters = parseChapters(bulk.text);
    if (!chapters.length) return toast.error("Add at least one line like '0:00 Lesson title'.");
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/programs/${programId}/lessons/bulk`, {
        youtube_url: bulk.youtube_url.trim(), chapters, free_preview_first: bulk.free_preview_first, is_private: bulk.is_private,
      });
      toast.success(`${data.created} lessons created from chapters.`);
      setBulk(null); await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Bulk create failed"); }
    finally { setBusy(false); }
  };

  const del = async (l) => {
    if (!window.confirm(`Delete lesson "${l.video?.title || "Lesson"}"?`)) return;
    try { await api.delete(`/admin/lessons/${l.id}`); toast.success("Lesson deleted."); await load(); }
    catch { toast.error("Delete failed"); }
  };

  const move = async (idx, dir) => {
    if (!lessons) return;
    const arr = [...lessons];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setLessons(arr);
    try { await api.post(`/admin/programs/${programId}/lessons/reorder`, { lesson_ids: arr.map((l) => l.id) }); }
    catch { toast.error("Reorder failed"); load(); }
  };

  // ---- Bulk auto-chapters form ----
  if (bulk) {
    const preview = parseChapters(bulk.text);
    return (
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-4" data-testid="bulk-form">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Auto chapters — one video, many lessons</div>
          <button onClick={() => setBulk(null)} data-testid="bulk-cancel" className="text-sm text-[#6B7269] hover:text-[#1C221F]">Cancel</button>
        </div>
        <Field label="YouTube link (the full recording)">
          <input data-testid="bulk-youtube" className={lc} value={bulk.youtube_url} onChange={(e) => setB("youtube_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        <Field label="Chapters — paste a YouTube description or one 'time title' per line" hint="Timestamps are auto-detected; lines without a time are ignored. Each lesson runs until the next timestamp.">
          <textarea data-testid="bulk-text" rows={7} className={lc + " font-mono !text-[13px]"} value={bulk.text} onChange={(e) => setB("text", e.target.value)} />
        </Field>
        <div className="text-xs text-[#6B7269]" data-testid="bulk-preview">Will create <b>{preview.length}</b> lessons: {preview.slice(0, 4).map((c) => `${secToMMSS(c.start_seconds)} ${c.title}`).join(" · ")}{preview.length > 4 ? " …" : ""}</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" data-testid="bulk-freepreview" checked={bulk.free_preview_first} onChange={(e) => setB("free_preview_first", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
          <Eye className="h-4 w-4 text-[#839682]" /> Make the first lesson a free preview
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" data-testid="bulk-private" checked={bulk.is_private} onChange={(e) => setB("is_private", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
          <EyeOff className="h-4 w-4 text-[#6B7269]" /> Unlisted link (paid content — not searchable on YouTube)
        </label>
        <button onClick={saveBulk} disabled={busy} data-testid="bulk-save" className="pill pill-primary w-full"><ListPlus className="h-4 w-4" /> {busy ? "Creating…" : `Create ${preview.length} lessons`}</button>
      </div>
    );
  }

  // ---- Single lesson form ----
  if (form) {
    const thumb = youTubeThumb(form.youtube_url);
    return (
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-4" data-testid="lesson-form">
        <div className="flex items-center justify-between">
          <div className="eyebrow">{form.id ? "Edit lesson" : "New lesson"}</div>
          <button onClick={() => setForm(null)} data-testid="lesson-cancel" className="text-sm text-[#6B7269] hover:text-[#1C221F]">Cancel</button>
        </div>
        <Field label="Lesson title"><input data-testid="lesson-title" className={lc} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Standing Deep Breathing" /></Field>
        <Field label="YouTube link">
          <input data-testid="lesson-youtube" className={lc} value={form.youtube_url} onChange={(e) => set("youtube_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          {form.youtube_url && !parseYouTubeId(form.youtube_url) && <div className="text-xs text-[#B25A45] mt-1">Not a recognized YouTube link.</div>}
        </Field>
        {thumb && (
          <div className="flex items-center gap-3">
            <img src={thumb} alt="" className="h-14 w-24 rounded-lg object-cover border border-[#E5E6DF]" />
            <div className="text-xs text-[#6B7269]">Lesson thumbnail (auto)</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start (m:ss)"><input data-testid="lesson-start" className={lc} value={form.start} onChange={(e) => set("start", e.target.value)} placeholder="0:00" /></Field>
          <Field label="End (m:ss) — optional"><input data-testid="lesson-end" className={lc} value={form.end} onChange={(e) => set("end", e.target.value)} placeholder="10:00" /></Field>
        </div>
        <p className="text-xs text-[#6B7269] -mt-1">Slice one long video into lessons: e.g. start <b>0:00</b> end <b>10:00</b> for lesson 1, then <b>10:00</b>–<b>22:30</b> for lesson 2.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" data-testid="lesson-freepreview" checked={form.is_free_preview} onChange={(e) => set("is_free_preview", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
          <Eye className="h-4 w-4 text-[#839682]" /> Free preview (anyone can watch)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" data-testid="lesson-private" checked={form.is_private} onChange={(e) => set("is_private", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
          <EyeOff className="h-4 w-4 text-[#6B7269]" /> Unlisted link (paid content — not searchable on YouTube)
        </label>

        {/* Assignment / graded submission gate */}
        <div className="rounded-2xl bg-[#F7F7F2] border border-[#E5E6DF] p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" data-testid="lesson-requires-submission" checked={form.requires_submission} onChange={(e) => set("requires_submission", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
            <ClipboardCheck className="h-4 w-4 text-[#B25A45]" /> Require a graded submission to unlock the next lesson
          </label>
          {form.requires_submission && (
            <>
              <Field label="Assignment prompt" hint="Tell the student what to record/practise. This guides the AI grader too.">
                <textarea data-testid="lesson-assignment-prompt" rows={3} className={lc} value={form.assignment_prompt} onChange={(e) => set("assignment_prompt", e.target.value)} placeholder="e.g. Record yourself holding Standing Bow for 30s. Focus on a locked standing knee and level hips." />
              </Field>
              <Field label="Pass mark (%)" hint="Minimum AI/instructor score to unlock the next lesson.">
                <input data-testid="lesson-pass-threshold" type="number" min="0" max="100" className={lc} value={form.pass_threshold} onChange={(e) => set("pass_threshold", e.target.value)} />
              </Field>
              <Field label="Max attempts" hint="How many tries a student gets before lockout. 0 = unlimited.">
                <input data-testid="lesson-max-attempts" type="number" min="0" max="20" className={lc} value={form.max_attempts} onChange={(e) => set("max_attempts", e.target.value)} />
              </Field>
            </>
          )}
        </div>

        <button onClick={save} disabled={busy} data-testid="lesson-save" className="pill pill-primary w-full"><Save className="h-4 w-4" /> {busy ? "Saving…" : (form.id ? "Save lesson" : "Add lesson")}</button>
      </div>
    );
  }

  // ---- Lessons list ----
  return (
    <div className="space-y-3" data-testid="lessons-editor">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Lessons {lessons ? `(${lessons.length})` : ""}</div>
        <div className="flex items-center gap-2">
          <button onClick={openBulk} data-testid="lesson-bulk" className="pill pill-ghost !py-1.5 !px-3 !text-xs"><ListPlus className="h-3.5 w-3.5" /> Auto chapters</button>
          <button onClick={openNew} data-testid="lesson-new" className="pill pill-primary !py-1.5 !px-3 !text-xs"><Plus className="h-3.5 w-3.5" /> Add lesson</button>
        </div>
      </div>
      {lessons === null ? <Spinner /> : lessons.length === 0 ? (
        <p className="text-sm text-[#6B7269] py-4 text-center">No lessons yet — add one, or paste a video's chapters with “Auto chapters”.</p>
      ) : (
        <ul className="space-y-2" data-testid="lessons-list">
          {lessons.map((l, idx) => {
            const yt = isYouTube(l.video?.source_url || l.video?.video_url);
            const seg = (l.video?.start_seconds || l.video?.end_seconds)
              ? `${secToMMSS(l.video?.start_seconds || 0)}${l.video?.end_seconds ? `–${secToMMSS(l.video.end_seconds)}` : "+"}`
              : null;
            return (
              <li key={l.id} data-testid={`lesson-row-${l.id}`} className="rounded-2xl bg-white border border-[#E5E6DF] p-3 flex items-center gap-3">
                <div className="flex flex-col">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} data-testid={`lesson-up-${l.id}`} className="text-[#9AA29B] hover:text-[#1C221F] disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === lessons.length - 1} data-testid={`lesson-down-${l.id}`} className="text-[#9AA29B] hover:text-[#1C221F] disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                </div>
                <div className="relative h-11 w-20 shrink-0 rounded-lg overflow-hidden bg-[#F2F2EC]">
                  {l.video?.cover_image
                    ? <img src={l.video.cover_image} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full flex items-center justify-center text-xs text-[#9AA29B]">{idx + 1}</div>}
                  <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-black/60 text-white text-[9px] font-semibold flex items-center justify-center">{idx + 1}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold leading-tight truncate">{l.video?.title || "Lesson"}</div>
                  <div className="text-[11px] text-[#6B7269] mt-0.5 flex items-center gap-2 flex-wrap">
                    {yt ? <span className="inline-flex items-center gap-1 text-[#B25A45]"><Youtube className="h-3 w-3" /> YouTube</span> : <span>Video</span>}
                    {seg && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {seg}</span>}
                    {l.is_free_preview && <span className="uppercase tracking-widest text-[9px] font-bold text-[#839682]">Free</span>}
                    {l.video?.is_private && <span className="inline-flex items-center gap-1 uppercase tracking-widest text-[9px] font-bold text-[#6B7269]"><EyeOff className="h-3 w-3" /> Unlisted</span>}
                  </div>
                </div>
                <button onClick={() => openEdit(l)} data-testid={`lesson-edit-${l.id}`} className="pill pill-ghost !py-1.5 !px-3 !text-xs shrink-0">Edit</button>
                <button onClick={() => del(l)} data-testid={`lesson-delete-${l.id}`} className="text-[#B25A45] hover:text-[#8f4436] shrink-0"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CoursesPane() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // program object being edited, or {__new:true}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/programs"); setList(data); } catch { setList([]); }
  };
  useEffect(() => { load(); }, []);

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      title: p.title || "", description: p.description || "", level: p.level || "all",
      style: p.style || "Hatha", duration_weeks: p.duration_weeks ?? 4,
      price: p.price ?? 0, currency: p.currency || "eur", price_model: p.price_model || "one_time",
      cover_image: p.cover_image || "", benefits: (p.benefits || []).join("\n"),
      drip_enabled: !!p.drip_enabled, drip_interval_days: p.drip_interval_days ?? 7,
    });
  };
  const openNew = () => {
    setEditing({ __new: true });
    setForm({ title: "", description: "", level: "beginner", style: "Hatha", duration_weeks: 4, price: 0, currency: "eur", price_model: "one_time", cover_image: "", benefits: "", drip_enabled: false, drip_interval_days: 7 });
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return toast.error("Title and description are required.");
    setSaving(true);
    const body = {
      title: form.title, description: form.description, level: form.level, style: form.style,
      duration_weeks: Number(form.duration_weeks) || 1, price: Number(form.price) || 0,
      currency: form.currency, price_model: form.price_model, cover_image: form.cover_image || null,
      benefits: form.benefits.split("\n").map((b) => b.trim()).filter(Boolean),
      drip_enabled: !!form.drip_enabled, drip_interval_days: Number(form.drip_interval_days) || 7,
    };
    try {
      if (editing.__new) {
        await api.post("/admin/programs", { ...body, instructor_id: user.id });
        toast.success("Course created.");
      } else {
        await api.patch(`/admin/programs/${editing.id}`, body);
        toast.success("Course updated.");
      }
      setEditing(null);
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const inputCls2 = "w-full rounded-2xl border border-[#E5E6DF] px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]";

  if (list === null) return <Spinner />;

  if (editing) {
    return (
      <div className="space-y-4" data-testid="admin-course-editor">
        <button onClick={() => setEditing(null)} data-testid="course-back" className="flex items-center gap-1 text-sm text-[#6B7269] hover:text-[#1C221F]"><ArrowLeft className="h-4 w-4" /> All courses</button>
        <div className="rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-4">
          <Field label="Title"><input data-testid="course-title" className={inputCls2} value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Description"><textarea data-testid="course-description" rows={4} className={inputCls2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <select data-testid="course-level" className={inputCls2} value={form.level} onChange={(e) => set("level", e.target.value)}>
                {["beginner", "intermediate", "advanced", "all"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Style"><input data-testid="course-style" className={inputCls2} value={form.style} onChange={(e) => set("style", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Weeks"><input data-testid="course-weeks" type="number" className={inputCls2} value={form.duration_weeks} onChange={(e) => set("duration_weeks", e.target.value)} /></Field>
            <Field label="Price"><input data-testid="course-price" type="number" className={inputCls2} value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
            <Field label="Currency"><input data-testid="course-currency" className={inputCls2} value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
          </div>
          <Field label="Pricing model">
            <div className="flex gap-2">
              {["one_time", "membership", "free"].map((m) => (
                <button key={m} type="button" onClick={() => set("price_model", m)} data-testid={`course-pricemodel-${m}`}
                  className={`pill !py-2 !px-4 !text-[13px] ${form.price_model === m ? "pill-primary" : "pill-ghost"}`}>{m.replace("_", " ")}</button>
              ))}
            </div>
          </Field>
          <Field label="Cover image URL"><input data-testid="course-cover" className={inputCls2} value={form.cover_image} onChange={(e) => set("cover_image", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Benefits (one per line)"><textarea data-testid="course-benefits" rows={4} className={inputCls2} value={form.benefits} onChange={(e) => set("benefits", e.target.value)} /></Field>
          <div className="rounded-2xl bg-[#F7F7F2] border border-[#E5E6DF] p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" data-testid="course-drip" checked={!!form.drip_enabled} onChange={(e) => set("drip_enabled", e.target.checked)} className="h-4 w-4 accent-[#B25A45]" />
              <span className="font-semibold">Drip schedule — release lessons over time</span>
            </label>
            {form.drip_enabled && (
              <div className="flex items-center gap-2 text-sm text-[#545E56]">
                Release one lesson every
                <input data-testid="course-drip-interval" type="number" min={1} className="w-20 rounded-xl border border-[#E5E6DF] px-3 py-1.5 text-[14px]" value={form.drip_interval_days} onChange={(e) => set("drip_interval_days", e.target.value)} />
                days after a student enrolls.
              </div>
            )}
            <p className="text-xs text-[#6B7269]">Lesson 1 is available immediately; lesson 2 after one interval, and so on. Free previews are always open.</p>
          </div>
          <button onClick={save} disabled={saving} data-testid="course-save" className="pill pill-primary w-full"><Save className="h-4 w-4" /> {saving ? "Saving…" : (editing.__new ? "Create course" : "Save changes")}</button>
        </div>
        {editing.__new ? (
          <p className="text-xs text-[#6B7269] text-center">Save the course first, then add lessons.</p>
        ) : (
          <div className="rounded-2xl bg-[#F7F7F2] border border-[#E5E6DF] p-5">
            <LessonsEditor programId={editing.id} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="admin-courses">
      <button onClick={openNew} data-testid="course-new" className="pill pill-primary w-full"><Plus className="h-4 w-4" /> New course</button>
      {list.length === 0 ? (
        <p className="text-sm text-[#6B7269] py-6 text-center">No courses yet — create your first one.</p>
      ) : list.map((p) => (
        <button key={p.id} onClick={() => openEdit(p)} data-testid={`course-row-${p.id}`}
          className="w-full text-left rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition flex items-center gap-3">
          {p.cover_image && <img src={p.cover_image} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold truncate">{p.title}</div>
            <div className="text-[11px] text-[#6B7269] mt-0.5 capitalize">{p.level} · {p.duration_weeks} weeks · {p.currency?.toUpperCase()} {Math.round(p.price)}</div>
          </div>
          <span className="text-xs text-[#B25A45] shrink-0">Edit</span>
        </button>
      ))}
    </div>
  );
}

function AssistantCard({ form, set, inputCls, card }) {
  const [leads, setLeads] = useState(null);
  const [showLeads, setShowLeads] = useState(false);
  useEffect(() => { api.get("/admin/assistant/leads").then(({ data }) => setLeads(data.leads)).catch(() => setLeads([])); }, []);
  return (
    <div className={card} data-testid="settings-assistant-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#B25A45]"><MessageCircle className="h-4 w-4" /><span className="eyebrow !text-[11px]">AI Assistant · Homepage</span></div>
        <Toggle checked={form.assistant_enabled} onChange={(v) => set("assistant_enabled", v)} tid="settings-assistant-enabled" />
      </div>
      <p className="text-[12px] text-[#6B7269] -mt-1">A calm chat + voice helper that greets visitors, recommends courses, and captures leads. Powered by the Emergent universal key.</p>
      <Field label="Greeting message"><textarea data-testid="settings-assistant-greeting" rows={2} className={inputCls} value={form.assistant_greeting} onChange={(e) => set("assistant_greeting", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Popup delay (seconds)"><input data-testid="settings-assistant-delay" type="number" min="0" className={inputCls} value={form.assistant_popup_delay} onChange={(e) => set("assistant_popup_delay", e.target.value)} /></Field>
        <Field label="WhatsApp number" hint="For the 'Chat with Tony' handoff (with country code)."><input data-testid="settings-assistant-whatsapp" className={inputCls} value={form.social_whatsapp} onChange={(e) => set("social_whatsapp", e.target.value)} placeholder="+34 600 000 000" /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowLeads((v) => !v)} data-testid="settings-assistant-leads-toggle" className="pill pill-ghost !py-1.5 !px-3 !text-xs">
          <Users className="h-3.5 w-3.5" /> {showLeads ? "Hide" : "View"} captured leads {leads ? `(${leads.length})` : ""}
        </button>
        <button
          type="button"
          data-testid="settings-assistant-leads-export"
          onClick={async () => {
            try {
              const res = await api.get("/admin/assistant/leads/export.csv", { responseType: "blob" });
              const href = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
              const a = document.createElement("a"); a.href = href; a.download = "ai_leads.csv"; a.click();
              URL.revokeObjectURL(href);
            } catch { toast.error("Export failed"); }
          }}
          className="pill pill-ghost !py-1.5 !px-3 !text-xs"
        >
          <Users className="h-3.5 w-3.5" /> Export leads CSV
        </button>
      </div>
      {showLeads && leads && (
        <ul className="space-y-2 pt-1" data-testid="assistant-leads-list">
          {leads.length === 0 ? <li className="text-xs text-[#6B7269]">No leads captured yet.</li> : leads.slice(0, 30).map((l) => (
            <li key={l.id} className="rounded-xl bg-[#F7F7F2] border border-[#E5E6DF] p-2.5 text-xs" data-testid={`assistant-lead-${l.id}`}>
              <div className="font-semibold">{l.name || "—"} <span className="font-normal text-[#6B7269]">· {l.email || "no email"} · {l.phone || "no phone"}</span></div>
              {l.interest && <div className="text-[#6B7269] mt-0.5">Interest: {l.interest}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BundlesPane() {
  const [bundles, setBundles] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const ic = "w-full rounded-xl border border-[#E5E6DF] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#B25A45]";

  const load = async () => {
    try {
      const [b, p] = await Promise.all([api.get("/admin/bundles"), api.get("/programs")]);
      setBundles(b.data); setPrograms(p.data);
    } catch { setBundles([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openNew = () => setForm({ title: "", description: "", price: 0, currency: "eur", program_ids: [], active: true });
  const openEdit = (b) => setForm({ id: b.id, title: b.title, description: b.description || "", price: b.price, currency: b.currency || "eur", program_ids: [...(b.program_ids || [])], active: b.active !== false });
  const toggleProg = (pid) => setForm((f) => ({ ...f, program_ids: f.program_ids.includes(pid) ? f.program_ids.filter((x) => x !== pid) : [...f.program_ids, pid] }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Bundle title is required.");
    if (form.program_ids.length < 2) return toast.error("Pick at least two courses for a bundle.");
    setBusy(true);
    const body = { title: form.title.trim(), description: form.description, price: Number(form.price) || 0, currency: form.currency, program_ids: form.program_ids, active: form.active };
    try {
      if (form.id) await api.patch(`/admin/bundles/${form.id}`, body);
      else await api.post("/admin/bundles", body);
      toast.success("Bundle saved."); setForm(null); await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };
  const del = async (b) => {
    if (!window.confirm(`Delete bundle "${b.title}"?`)) return;
    try { await api.delete(`/admin/bundles/${b.id}`); toast.success("Bundle deleted."); await load(); } catch { toast.error("Delete failed"); }
  };

  const total = form ? programs.filter((p) => form.program_ids.includes(p.id)).reduce((s, p) => s + (p.price || 0), 0) : 0;

  if (form) {
    return (
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-5 space-y-4" data-testid="bundle-form">
        <div className="flex items-center justify-between">
          <div className="eyebrow">{form.id ? "Edit bundle" : "New bundle"}</div>
          <button onClick={() => setForm(null)} data-testid="bundle-cancel" className="text-sm text-[#6B7269] hover:text-[#1C221F]">Cancel</button>
        </div>
        <Field label="Bundle title"><input data-testid="bundle-title" className={ic} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. The Core Collection" /></Field>
        <Field label="Description"><textarea data-testid="bundle-desc" rows={2} className={ic} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div>
          <div className="text-[11px] uppercase tracking-widest font-semibold text-[#839682] mb-2">Courses in this bundle</div>
          <ul className="space-y-2" data-testid="bundle-programs">
            {programs.map((p) => (
              <li key={p.id}>
                <label className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E6DF] px-3 py-2 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm">
                    <input type="checkbox" data-testid={`bundle-prog-${p.id}`} checked={form.program_ids.includes(p.id)} onChange={() => toggleProg(p.id)} className="h-4 w-4 accent-[#B25A45]" />
                    {p.title}
                  </span>
                  <span className="text-xs text-[#6B7269]">€{Math.round(p.price || 0)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bundle price (€)"><input data-testid="bundle-price" type="number" className={ic} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <div className="flex items-end pb-2 text-sm text-[#545E56]">Individually €{Math.round(total)} · save <b className="ml-1 text-[#B25A45]">€{Math.round(Math.max(0, total - (Number(form.price) || 0)))}</b></div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" data-testid="bundle-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-[#B25A45]" />
          Active (visible to students)
        </label>
        <button onClick={save} disabled={busy} data-testid="bundle-save" className="pill pill-primary w-full"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save bundle"}</button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="bundles-pane">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Course bundles {bundles ? `(${bundles.length})` : ""}</div>
        <button onClick={openNew} data-testid="bundle-new" className="pill pill-primary !py-1.5 !px-3 !text-xs"><Plus className="h-3.5 w-3.5" /> New bundle</button>
      </div>
      {bundles === null ? <Spinner /> : bundles.length === 0 ? (
        <p className="text-sm text-[#6B7269] py-4 text-center">No bundles yet. Group several courses into one discounted purchase.</p>
      ) : (
        <ul className="space-y-2" data-testid="bundles-list">
          {bundles.map((b) => (
            <li key={b.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-4" data-testid={`bundle-row-${b.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#B25A45]" />
                    <span className="text-[15px] font-semibold truncate">{b.title}</span>
                    {b.active === false && <span className="text-[10px] uppercase tracking-widest font-bold text-[#B25A45]">hidden</span>}
                  </div>
                  <div className="text-xs text-[#6B7269] mt-1">{(b.programs || []).length} courses · €{Math.round(b.price)} <span className="text-[#839682]">(save €{Math.round(b.savings || 0)})</span></div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(b)} data-testid={`bundle-edit-${b.id}`} className="pill pill-ghost !py-1 !px-2.5 !text-xs">Edit</button>
                  <button onClick={() => del(b)} data-testid={`bundle-delete-${b.id}`} className="text-[#B25A45] hover:text-[#8f4436]"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentsPane() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/students/progress").then(({ data }) => setData(data)).catch(() => setData(false)); }, []);
  if (data === null) return <Spinner />;
  if (data === false) return <p className="text-sm text-[#6B7269] py-4 text-center">Could not load students.</p>;

  return (
    <div className="space-y-3" data-testid="students-pane">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Students ({data.total})</div>
        <button
          data-testid="export-certificates-csv"
          onClick={async () => {
            try {
              const res = await api.get("/admin/certificates/export.csv", { responseType: "blob" });
              const href = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
              const a = document.createElement("a");
              a.href = href; a.download = "certificates.csv"; a.click();
              URL.revokeObjectURL(href);
            } catch { toast.error("Export failed"); }
          }}
          className="pill pill-ghost !py-1.5 !px-3 !text-xs"
        >
          <Award className="h-3.5 w-3.5" /> Export certificates CSV
        </button>
      </div>
      {data.students.length === 0 ? (
        <p className="text-sm text-[#6B7269] py-4 text-center">No students yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="students-list">
          {data.students.map((s) => (
            <li key={s.user_id} className="rounded-2xl bg-white border border-[#E5E6DF] p-4 space-y-3" data-testid={`student-row-${s.user_id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate">{s.name || s.email}</div>
                  <div className="text-xs text-[#6B7269] truncate">{s.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.active_member && <span className="text-[10px] uppercase tracking-widest font-bold text-[#839682] bg-[#EEF1EC] rounded-full px-2 py-1">Member</span>}
                  {s.certificates > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold text-[#B25A45]"><Award className="h-3.5 w-3.5" /> {s.certificates}</span>}
                </div>
              </div>
              {s.enrollments.length === 0 ? (
                <div className="text-xs text-[#6B7269]">Not enrolled in any course yet.</div>
              ) : (
                <ul className="space-y-2">
                  {s.enrollments.map((e) => (
                    <li key={e.program_id} data-testid={`student-${s.user_id}-prog-${e.program_id}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="truncate flex items-center gap-1.5">{e.certified && <Award className="h-3 w-3 text-[#B25A45]" />}{e.program_title}</span>
                        <span className="text-[#6B7269] shrink-0">{e.completed}/{e.total} · {e.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EEF1EC] overflow-hidden">
                        <div className="h-full bg-[#B25A45]" style={{ width: `${e.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function RetreatsPane() {
  const empty = { title: "", system: "Core 40", description: "", location: "Villa San Pedro · Málaga, Spain",
    start_date: "", end_date: "", price_eur: 1600, deposit_eur: 500, capacity: 14, cover_image: "" };
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const ic = "w-full rounded-xl border border-[#E5E6DF] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#B25A45]";
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => api.get("/admin/workshops").then(({ data }) => setRows(data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim() || !form.start_date || !form.end_date) return toast.error("Title and both dates are required.");
    setBusy(true);
    try {
      await api.post("/admin/workshops", {
        ...form,
        price_eur: Number(form.price_eur) || 0,
        deposit_eur: Number(form.deposit_eur) || 0,
        capacity: Number(form.capacity) || 14,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
      });
      toast.success("Retreat published");
      setForm(empty); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not publish"); }
    finally { setBusy(false); }
  };

  const toggleActive = async (w) => {
    try { await api.patch(`/admin/workshops/${w.id}`, { is_active: !w.is_active }); load(); }
    catch { toast.error("Failed"); }
  };
  const remove = async (w) => {
    if (!window.confirm(`Delete "${w.title}"? This cannot be undone.`)) return;
    try { await api.delete(`/admin/workshops/${w.id}`); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-4" data-testid="retreats-pane">
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4 space-y-3">
        <div className="eyebrow">Publish a retreat</div>
        <input data-testid="retreat-title" className={ic} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Title — e.g. Tree of Yoga · Core 40" />
        <div className="grid grid-cols-2 gap-3">
          <input data-testid="retreat-system" className={ic} value={form.system} onChange={(e) => set("system", e.target.value)} placeholder="System (Core 40)" />
          <input data-testid="retreat-location" className={ic} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Location" />
        </div>
        <textarea data-testid="retreat-description" rows={2} className={ic} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-[#6B7269]">Start date<input data-testid="retreat-start" type="date" className={ic} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></label>
          <label className="text-xs text-[#6B7269]">End date<input data-testid="retreat-end" type="date" className={ic} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-[#6B7269]">Price €<input data-testid="retreat-price" type="number" className={ic} value={form.price_eur} onChange={(e) => set("price_eur", e.target.value)} /></label>
          <label className="text-xs text-[#6B7269]">Deposit €<input data-testid="retreat-deposit" type="number" className={ic} value={form.deposit_eur} onChange={(e) => set("deposit_eur", e.target.value)} /></label>
          <label className="text-xs text-[#6B7269]">Capacity<input data-testid="retreat-capacity" type="number" className={ic} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} /></label>
        </div>
        <input data-testid="retreat-cover" className={ic} value={form.cover_image} onChange={(e) => set("cover_image", e.target.value)} placeholder="Cover image URL (optional)" />
        <button onClick={create} disabled={busy} data-testid="retreat-create" className="pill pill-primary w-full">{busy ? "Publishing…" : "Publish retreat"}</button>
      </div>

      <div className="eyebrow">All retreats {rows?.length ? `(${rows.length})` : ""}</div>
      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <p className="text-sm text-[#6B7269] rounded-2xl bg-[#F2F2EC] p-5">No retreats yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="retreats-list">
          {rows.map((w) => (
            <li key={w.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-3 flex items-center justify-between gap-3" data-testid={`retreat-row-${w.id}`}>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">{w.title}</div>
                <div className="text-xs text-[#6B7269]">{String(w.start_date).slice(0, 10)} → {String(w.end_date).slice(0, 10)} · €{w.price_eur} · €{w.deposit_eur ?? 500} deposit</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(w)} data-testid={`retreat-toggle-${w.id}`} className="text-xs rounded-full px-2.5 py-1 font-semibold" style={{ background: w.is_active ? "#EEF1EC" : "#F2F2EC", color: w.is_active ? "#5C7355" : "#6B7269" }}>{w.is_active ? "Active" : "Hidden"}</button>
                <button onClick={() => remove(w)} data-testid={`retreat-delete-${w.id}`} className="text-xs text-[#B25A45] hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function GiftCardsPane() {
  const [cards, setCards] = useState(null);
  const [amount, setAmount] = useState(50);
  const [currency, setCurrency] = useState("eur");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/gift-cards").then(({ data }) => setCards(data)).catch(() => setCards(false));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter a positive amount.");
    setBusy(true);
    try {
      const { data } = await api.post("/admin/gift-cards", { amount: Number(amount), currency, note: note || null });
      toast.success(`Created ${data.code}`);
      setNote("");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not create"); }
    finally { setBusy(false); }
  };

  const deactivate = async (code) => {
    try { await api.post(`/admin/gift-cards/${code}/deactivate`); load(); }
    catch { toast.error("Failed"); }
  };

  const sym = (c) => (c === "usd" ? "$" : "€");
  const ic = "w-full rounded-xl border border-[#E5E6DF] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#B25A45]";

  return (
    <div className="space-y-4" data-testid="giftcards-pane">
      <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4 space-y-3">
        <div className="eyebrow">Issue a gift card</div>
        <div className="flex gap-2">
          <input data-testid="giftcard-amount" type="number" min="1" className={ic} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          <select data-testid="giftcard-currency" className={ic + " max-w-[110px]"} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="eur">EUR €</option>
            <option value="usd">USD $</option>
          </select>
        </div>
        <input data-testid="giftcard-note" className={ic} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. Holiday promo" />
        <button onClick={create} disabled={busy} data-testid="giftcard-create" className="pill pill-primary w-full">{busy ? "Creating…" : "Create gift card"}</button>
      </div>

      <div className="eyebrow">Issued cards {cards?.length ? `(${cards.length})` : ""}</div>
      {cards === null ? <Spinner /> : cards === false ? (
        <p className="text-sm text-[#6B7269]">Could not load gift cards.</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-[#6B7269] rounded-2xl bg-[#F2F2EC] p-5">No gift cards yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="giftcards-list">
          {cards.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-3 flex items-center justify-between gap-3" data-testid={`giftcard-row-${c.code}`}>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold tracking-wide">{c.code}</div>
                <div className="text-xs text-[#6B7269]">{sym(c.currency)}{c.amount} · balance {sym(c.currency)}{c.balance}{c.note ? ` · ${c.note}` : ""}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-widest font-bold rounded-full px-2 py-1" style={{ background: c.status === "active" ? "#EEF1EC" : "#F2F2EC", color: c.status === "active" ? "#839682" : "#6B7269" }}>{c.status}</span>
                {c.status === "active" && (
                  <button onClick={() => deactivate(c.code)} data-testid={`giftcard-deactivate-${c.code}`} className="text-xs text-[#B25A45] hover:underline">Disable</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


export default function Admin() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const validTabs = ["stats", "courses", "bundles", "students", "classes", "apps", "broadcast", "retreats", "giftcards", "settings", "import"];
  const initialTab = validTabs.includes(params.get("tab")) ? params.get("tab") : "stats";
  const [tab, setTab] = useState(initialTab);
  const selectTab = (t) => { setTab(t); setParams(t === "stats" ? {} : { tab: t }, { replace: true }); };
  if (!ready) return null;
  if (!user || user.role !== "admin") return <Navigate to="/home" replace />;

  return (
    <div data-testid="admin-page" className="pb-6">
      <PageHeader eyebrow="Admin" title="Console" testId="admin-header" />
      <div className="mx-auto max-w-2xl px-5 space-y-5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="admin-tabs">
          <Tab active={tab === "stats"} onClick={() => selectTab("stats")} tid="admin-tab-stats">Overview</Tab>
          <Tab active={tab === "courses"} onClick={() => selectTab("courses")} tid="admin-tab-courses">Courses &amp; Videos</Tab>
          <Tab active={tab === "bundles"} onClick={() => selectTab("bundles")} tid="admin-tab-bundles">Bundles</Tab>
          <Tab active={tab === "students"} onClick={() => selectTab("students")} tid="admin-tab-students">Students</Tab>
          <Tab active={tab === "classes"} onClick={() => selectTab("classes")} tid="admin-tab-classes">Classes</Tab>
          <Tab active={tab === "apps"} onClick={() => selectTab("apps")} tid="admin-tab-apps">Applications</Tab>
          <Tab active={tab === "broadcast"} onClick={() => selectTab("broadcast")} tid="admin-tab-broadcast">Broadcast</Tab>
          <Tab active={tab === "retreats"} onClick={() => selectTab("retreats")} tid="admin-tab-retreats">Retreats</Tab>
          <Tab active={tab === "giftcards"} onClick={() => selectTab("giftcards")} tid="admin-tab-giftcards">Gift Cards</Tab>
          <Tab active={tab === "settings"} onClick={() => selectTab("settings")} tid="admin-tab-settings">Settings</Tab>
          <Tab active={tab === "import"} onClick={() => selectTab("import")} tid="admin-tab-import">Import</Tab>
        </div>

        <div className="pt-2">
          {tab === "stats" && <StatsPane />}
          {tab === "courses" && <CoursesPane />}
          {tab === "bundles" && <BundlesPane />}
          {tab === "students" && <StudentsPane />}
          {tab === "classes" && <ClassesPane />}
          {tab === "apps" && <ApplicationsPane />}
          {tab === "broadcast" && <BroadcastPane />}
          {tab === "retreats" && <RetreatsPane />}
          {tab === "giftcards" && <GiftCardsPane />}
          {tab === "settings" && <SettingsPane />}
          {tab === "import" && <ImportPane />}
        </div>
      </div>
    </div>
  );
}
