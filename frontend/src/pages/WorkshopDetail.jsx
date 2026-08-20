import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Utensils, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import HeartButton from "@/components/HeartButton";
import PaymentButtons from "@/components/PaymentButtons";

export default function WorkshopDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [w, setW] = useState(null);
  const [step, setStep] = useState("view");
  const [reservationId, setReservationId] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    yoga_status: "Perpetual Yogi",
    years_of_practice: 0,
    wants_teacher_training: false,
    notes: "",
  });

  useEffect(() => {
    api.get(`/workshops/${id}`).then(({ data }) => setW(data)).catch(() => setW(false));
  }, [id]);

  const beforeReservationCheckout = async () => {
    if (!user) { toast("Sign in to reserve."); nav("/login"); return false; }
    if (!form.name || !form.email) { toast.error("Name and email required"); return false; }
    if (reservationId) return true;
    try {
      const { data: reg } = await api.post("/retreats/reserve", { workshop_id: id, ...form });
      setReservationId(reg.id);
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reservation failed");
      return false;
    }
  };

  if (w === null) return <><PageHeader back /><Spinner /></>;
  if (w === false) return <><PageHeader back title="Not found" /></>;

  const spotsLeft = Math.max(0, (w.capacity || 14) - (w.registered_count || 0));

  return (
    <div data-testid="workshop-detail" className="pb-6">
      {w.cover_image && (
        <div className="relative h-72 overflow-hidden">
          <img src={w.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1C221F]/40 to-[#FAFAF7]" />
        </div>
      )}
      <PageHeader eyebrow={w.system} title={w.title} back testId="workshop-detail-header" action={<HeartButton targetType="workshop" targetId={w.id} />} />

      <div className="mx-auto max-w-2xl px-5 space-y-5">
        {step === "view" && (
          <>
            {w.subtitle && <p className="serif text-lg text-[#545E56] italic leading-relaxed">{w.subtitle}</p>}
            <p className="text-[15px] text-[#545E56] leading-relaxed">{w.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
                <Calendar className="h-4 w-4 text-[#B25A45] mb-2" />
                <div className="eyebrow !text-[10px]">Dates</div>
                <div className="text-sm mt-1 font-semibold">{new Date(w.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {new Date(w.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
              <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
                <MapPin className="h-4 w-4 text-[#B25A45] mb-2" />
                <div className="eyebrow !text-[10px]">Where</div>
                <div className="text-sm mt-1 font-semibold clamp-2">{w.location}</div>
              </div>
              <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
                <Users className="h-4 w-4 text-[#B25A45] mb-2" />
                <div className="eyebrow !text-[10px]">Capacity</div>
                <div className="text-sm mt-1 font-semibold" data-testid="workshop-spots-left">{spotsLeft} of {w.capacity} spots</div>
              </div>
              <div className="rounded-2xl bg-white border border-[#E5E6DF] p-4">
                <Utensils className="h-4 w-4 text-[#B25A45] mb-2" />
                <div className="eyebrow !text-[10px]">Included</div>
                <div className="text-sm mt-1 font-semibold">{w.nights} nights · {w.meals_included ? "meals" : ""}</div>
              </div>
            </div>

            <div className="rounded-3xl bg-[#1C221F] text-[#FAFAF7] p-6">
              <div className="eyebrow !text-[#B25A45] mb-2">Reserve your seat</div>
              <div className="flex items-baseline gap-3">
                <span className="serif text-4xl">€500</span>
                <span className="text-sm text-white/60">deposit</span>
              </div>
              <p className="text-xs text-white/60 mt-2">
                Full price €{Math.round(w.price_eur)} · Balance of €{Math.round(w.price_eur - 500)} due 30 days before start.
              </p>
              <button
                onClick={() => setStep("form")}
                disabled={spotsLeft === 0}
                data-testid="workshop-reserve-btn"
                className="pill !bg-[#B25A45] !text-white w-full mt-5"
              >
                {spotsLeft === 0 ? "Full — join waitlist" : "Reserve with €500 deposit"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {step === "form" && (
          <div className="space-y-3" data-testid="workshop-reserve-form">
            <div className="rounded-2xl bg-[#F2F2EC] p-4 text-xs text-[#545E56] leading-relaxed">
              You'll pay €500 now. Balance of <strong>€{Math.round(w.price_eur - 500)}</strong> is due 30 days before the retreat starts. Fully refundable up to 60 days out.
            </div>
            <input required data-testid="reserve-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
            <input required type="email" data-testid="reserve-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
            <input data-testid="reserve-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
            <div className="grid grid-cols-2 gap-3">
              <select data-testid="reserve-status" value={form.yoga_status} onChange={(e) => setForm({ ...form, yoga_status: e.target.value })} className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]">
                <option>Perpetual Yogi</option>
                <option>Instructor</option>
                <option>Aspiring Instructor</option>
              </select>
              <input type="number" min="0" max="80" data-testid="reserve-years" value={form.years_of_practice} onChange={(e) => setForm({ ...form, years_of_practice: parseInt(e.target.value || "0") })} placeholder="Years of practice" className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
            </div>
            {w.teacher_training_price_eur && (
              <label className="flex items-center gap-3 rounded-2xl bg-white border border-[#E5E6DF] p-3">
                <input type="checkbox" data-testid="reserve-tt" checked={form.wants_teacher_training} onChange={(e) => setForm({ ...form, wants_teacher_training: e.target.checked })} />
                <span className="text-sm">Add teacher training (+€{Math.round(w.teacher_training_price_eur)})</span>
              </label>
            )}
            <textarea rows={2} data-testid="reserve-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything Tony should know?" className="w-full rounded-2xl border border-[#E5E6DF] px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />

            <PaymentButtons
              itemType="workshop_deposit"
              itemId={reservationId || "pending"}
              stripeLabel="Pay €500 deposit"
              onBeforeCheckout={beforeReservationCheckout}
              testIdPrefix="reserve-pay"
              size="lg"
            />
            <button type="button" onClick={() => setStep("view")} className="text-center w-full text-sm text-[#6B7269] py-2">← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
