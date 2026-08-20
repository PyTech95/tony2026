import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { usePaymentProviders } from "@/lib/providers";
import { useAuth } from "@/lib/auth";

/**
 * Twin checkout buttons — Stripe (primary) + optional PayPal.
 *
 * Props:
 *   itemType: "membership" | "cart" | "workshop_deposit" | "workshop_balance" | "drop_in" | "class_pack" | "program" | "product"
 *   itemId:   The id used by the backend to resolve price
 *   stripeLabel: Text for the Stripe button. Default: "Pay with card"
 *   onBeforeCheckout: async () => optional — return false to abort (e.g. cart validation)
 *   size: "md" | "lg"
 *   variant: "vertical" | "horizontal"
 */
export default function PaymentButtons({
  itemType,
  itemId,
  stripeLabel = "Pay with card",
  onBeforeCheckout,
  disabled = false,
  size = "md",
  variant = "vertical",
  testIdPrefix = "pay",
}) {
  const { paypal: paypalAvailable } = usePaymentProviders();
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "instructor";
  const [busy, setBusy] = useState(null); // "stripe" | "paypal" | null

  const startStripe = async () => {
    if (disabled || busy) return;
    if (onBeforeCheckout) {
      const cont = await onBeforeCheckout();
      if (cont === false) return;
    }
    setBusy("stripe");
    try {
      const { data } = await api.post("/checkout/session", {
        item_type: itemType,
        item_id: itemId,
        origin_url: window.location.origin,
      });
      if (data?.url) window.location.href = data.url;
      else toast.error("Could not start Stripe checkout");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Checkout failed");
    } finally { setBusy(null); }
  };

  const startPaypal = async () => {
    if (disabled || busy) return;
    if (onBeforeCheckout) {
      const cont = await onBeforeCheckout();
      if (cont === false) return;
    }
    setBusy("paypal");
    try {
      const { data } = await api.post("/paypal/create-order", {
        item_type: itemType,
        item_id: itemId,
        origin_url: window.location.origin,
      });
      if (data?.url) window.location.href = data.url;
      else toast.error("Could not start PayPal checkout");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "PayPal not available yet");
    } finally { setBusy(null); }
  };

  const pillPad = size === "lg" ? "!py-3.5" : "";
  const wrap = variant === "horizontal" ? "flex gap-2" : "space-y-2";

  // Staff (admin/instructor) are previewing the app, not buying — show a note
  // instead of live checkout buttons so they don't accidentally start a payment.
  if (isStaff) {
    return (
      <div data-testid={`${testIdPrefix}-staff-note`} className="flex items-center gap-2 rounded-2xl bg-[#F2F2EC] border border-[#E5E6DF] px-4 py-3 text-[13px] text-[#6B7269]">
        <ShieldCheck className="h-4 w-4 text-[#839682] shrink-0" />
        <span>Staff preview — checkout is disabled for admin & instructor accounts.</span>
      </div>
    );
  }

  // PayPal is the primary method sitewide. When configured it renders first as the
  // prominent button; the card (Stripe) button is kept as a secondary/backup option.
  return (
    <div className={wrap} data-testid={`${testIdPrefix}-buttons`}>
      {paypalAvailable && (
        <button
          onClick={startPaypal}
          disabled={disabled || !!busy}
          data-testid={`${testIdPrefix}-paypal`}
          className={`pill w-full ${pillPad} !bg-[#FFC439] !text-[#003087] hover:!bg-[#F5B800]`}
        >
          <span className="font-bold italic">PayPal</span> {busy === "paypal" ? "· Redirecting…" : "· Pay securely"}
        </button>
      )}
      <button
        onClick={startStripe}
        disabled={disabled || !!busy}
        data-testid={`${testIdPrefix}-stripe`}
        className={`pill w-full ${pillPad} ${paypalAvailable ? "pill-ghost" : "pill-primary"}`}
      >
        <CreditCard className="h-4 w-4" /> {busy === "stripe" ? "Redirecting…" : (paypalAvailable ? "Or pay with card" : stripeLabel)}
      </button>
    </div>
  );
}
