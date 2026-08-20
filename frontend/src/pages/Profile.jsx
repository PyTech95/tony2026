import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, User as UserIcon, Sparkles, ShoppingBag, GraduationCap, Gift, Shield, Flame, MountainSnow, Ticket, Heart, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { usePaymentProviders } from "@/lib/providers";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import PushToggle from "@/components/PushToggle";

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [sub, setSub] = useState(null);
  const [retreats, setRetreats] = useState([]);
  const [payBusy, setPayBusy] = useState(null);
  const [credit, setCredit] = useState(0);
  const [gcCode, setGcCode] = useState("");
  const [gcBusy, setGcBusy] = useState(false);
  const { paypal: paypalAvailable } = usePaymentProviders();

  useEffect(() => {
    (async () => {
      try {
        const [b, s, r, c] = await Promise.all([
          api.get("/bookings/mine"),
          api.get("/subscriptions/mine").catch(() => ({ data: null })),
          api.get("/retreats/mine").catch(() => ({ data: [] })),
          api.get("/me/store-credit").catch(() => ({ data: { store_credit: 0 } })),
        ]);
        setBookings(b.data);
        setSub(s.data);
        setRetreats(r.data || []);
        setCredit(c.data?.store_credit || 0);
      } catch { setBookings([]); }
    })();
  }, []);

  const redeemGift = async () => {
    if (!gcCode.trim()) return toast.error("Enter a gift card code.");
    setGcBusy(true);
    try {
      const { data } = await api.post("/gift-cards/redeem", { code: gcCode.trim() });
      setCredit(data.store_credit);
      setGcCode("");
      toast.success(`Redeemed €${data.redeemed} · added to your store credit`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not redeem this code"); }
    finally { setGcBusy(false); }
  };

  const payBalance = async (r) => {
    setPayBusy(r.id);
    try {
      // PayPal is the primary method sitewide; fall back to card (Stripe) if not configured.
      const endpoint = paypalAvailable ? "/paypal/create-order" : "/checkout/session";
      const { data } = await api.post(endpoint, {
        item_type: "workshop_balance",
        item_id: r.id,
        origin_url: window.location.origin,
      });
      if (data?.url) window.location.href = data.url;
      else toast.error("Could not start balance checkout");
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setPayBusy(null); }
  };

  const cancel = async (id) => {
    try {
      await api.delete(`/bookings/${id}`);
      setBookings((bs) => bs.map((b) => b.id === id ? { ...b, status: "cancelled" } : b));
      toast.success("Booking cancelled");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not cancel");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("See you on the mat.");
    nav("/");
  };

  return (
    <div data-testid="profile-page">
      <PageHeader eyebrow="Your practice" title="Profile" testId="profile-header" />

      <div className="mx-auto max-w-2xl px-5 space-y-6">
        {/* User card */}
        <div className="rounded-3xl bg-white border border-[#E5E6DF] p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[#F2F2EC] flex items-center justify-center">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <UserIcon className="h-6 w-6 text-[#B25A45]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="serif text-xl leading-tight" data-testid="profile-name">{user?.name || "Yogi"}</div>
            <div className="text-xs text-[#6B7269] truncate" data-testid="profile-email">{user?.email}</div>
            <div className="mt-1 inline-block text-[10px] uppercase tracking-widest text-[#B25A45] font-semibold">
              {user?.role === "admin" ? "Instructor / Admin" : sub ? "Member" : "Student"}
            </div>
          </div>
        </div>

        {/* Bookings */}
        <section>
          <div className="eyebrow mb-3">Your bookings</div>
          {bookings === null ? <Spinner /> : bookings.length === 0 ? (
            <p className="text-sm text-[#6B7269] rounded-2xl bg-[#F2F2EC] p-5">No bookings yet. Try a class →</p>
          ) : (
            <ul className="space-y-2" data-testid="profile-bookings">
              {bookings.map((b) => (
                <li key={b.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold truncate">{b.class?.title || "Class"}</div>
                      <div className="text-xs text-[#6B7269] mt-0.5">{b.class ? formatWhen(b.class.start_time) : ""}</div>
                      <div className="text-[10px] uppercase tracking-widest mt-1.5 font-semibold" style={{ color: b.status === "confirmed" ? "#839682" : b.status === "waitlist" ? "#B25A45" : "#6B7269" }}>
                        {b.status}
                      </div>
                    </div>
                    {b.status !== "cancelled" && (
                      <button
                        onClick={() => cancel(b.id)}
                        data-testid={`profile-cancel-${b.id}`}
                        className="text-xs text-[#B25A45] hover:underline shrink-0"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reminders */}
        <PushToggle />

        {/* Gift card / store credit */}
        <section data-testid="gift-card-section" className="rounded-3xl bg-white border border-[#E5E6DF] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-[#B25A45]" />
              <span className="text-sm font-semibold text-[#1C221F]">Gift cards & credit</span>
            </div>
            <span data-testid="store-credit-balance" className="text-sm font-bold text-[#B25A45]">€{credit.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              data-testid="gift-card-input"
              value={gcCode}
              onChange={(e) => setGcCode(e.target.value.toUpperCase())}
              placeholder="GIFT-XXXXXXXX"
              className="flex-1 rounded-xl border border-[#E5E6DF] bg-[#FAFAF7] px-3 py-2 text-sm tracking-wide focus:outline-none focus:border-[#B25A45]"
            />
            <button onClick={redeemGift} disabled={gcBusy} data-testid="gift-card-redeem" className="pill pill-primary !py-2 !px-4 !text-xs shrink-0">
              {gcBusy ? "…" : "Redeem"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#9AA096]">Redeem a gift card to add store credit to your account.</p>
        </section>

        {/* Retreats */}
        {retreats.length > 0 && (
          <section data-testid="profile-retreats">
            <div className="eyebrow mb-3">Your retreats</div>
            <ul className="space-y-2">
              {retreats.map((r) => (
                <li key={r.id} className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#F2F2EC] flex items-center justify-center shrink-0">
                      <MountainSnow className="h-4 w-4 text-[#B25A45]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold truncate">{r.workshop_title}</div>
                      <div className="text-xs text-[#6B7269] mt-0.5">{new Date(r.workshop_start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div className="text-[10px] uppercase tracking-widest mt-1.5 font-semibold" style={{ color: r.status === "paid_in_full" ? "#839682" : r.status === "deposit_paid" ? "#B25A45" : "#6B7269" }}>
                        {r.status === "paid_in_full" ? "Paid in full" : r.status === "deposit_paid" ? `Deposit paid · balance €${Math.round(r.balance_eur)} due ${new Date(r.balance_due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : `Pending deposit €${Math.round(r.deposit_eur)}`}
                      </div>
                    </div>
                    {r.status === "deposit_paid" && (
                      <button
                        onClick={() => payBalance(r)}
                        disabled={payBusy === r.id}
                        data-testid={`retreat-pay-balance-${r.id}`}
                        className="pill pill-primary !py-1.5 !px-3 !text-xs shrink-0"
                      >
                        {payBusy === r.id ? "…" : `Pay €${Math.round(r.balance_eur)}`}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Links */}
        <section className="grid grid-cols-2 gap-3">
          <Link to="/streak" data-testid="profile-link-streak" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <Flame className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Practice streak</div>
          </Link>
          <Link to="/leaderboard" data-testid="profile-link-leaderboard" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <Trophy className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Leaderboard</div>
          </Link>
          <Link to="/wishlist" data-testid="profile-link-wishlist" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <Heart className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Wishlist</div>
          </Link>
          <Link to="/passes" data-testid="profile-link-passes" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <Ticket className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Class passes</div>
          </Link>
          <Link to="/memberships" data-testid="profile-link-memberships" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <Sparkles className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Memberships</div>
          </Link>
          <Link to="/referrals" data-testid="profile-link-referrals" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <Gift className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Invite a friend</div>
          </Link>
          <Link to="/shop" data-testid="profile-link-shop" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <ShoppingBag className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Shop</div>
          </Link>
          <Link to="/workshops" data-testid="profile-link-workshops" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
            <GraduationCap className="h-5 w-5 text-[#B25A45] mb-2" />
            <div className="text-sm font-semibold">Retreats</div>
          </Link>
          {(user?.role === "instructor" || user?.role === "admin") && (
            <Link to="/instructor" data-testid="profile-link-instructor" className="rounded-2xl bg-white border border-[#E5E6DF] p-4 hover:border-[#B25A45] transition">
              <GraduationCap className="h-5 w-5 text-[#B25A45] mb-2" />
              <div className="text-sm font-semibold">Instructor studio</div>
              <div className="text-[11px] text-[#6B7269] mt-0.5">Earnings & your classes</div>
            </Link>
          )}
          {user?.role === "admin" && (
            <Link to="/admin" data-testid="profile-link-admin" className="rounded-2xl bg-[#1C221F] text-[#FAFAF7] p-4 hover:opacity-90 transition">
              <Shield className="h-5 w-5 text-[#B25A45] mb-2" />
              <div className="text-sm font-semibold">Admin console</div>
              <div className="text-[11px] text-white/60 mt-0.5">Manage everything</div>
            </Link>
          )}
        </section>

        <button
          onClick={handleLogout}
          data-testid="profile-signout"
          className="pill pill-ghost w-full !text-[#B25A45]"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
