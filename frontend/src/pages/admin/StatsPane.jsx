import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Calendar, TrendingUp, Send, Check, X, CreditCard, Mail, Bell, Save, RefreshCw, History, BookOpen, Plus, ArrowLeft, Trash2, ChevronUp, ChevronDown, ChevronRight, Youtube, Play, Clock, Eye, EyeOff, ListPlus, Instagram, Wallet, ClipboardCheck, Package, GraduationCap, Award, MessageCircle, Video, Mic, LayoutDashboard, MountainSnow, Gift, Settings as SettingsIcon, Upload } from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

export default StatsPane;
