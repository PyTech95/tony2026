import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";

export function CheckoutSuccess() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [status, setStatus] = useState("checking");
  const [tries, setTries] = useState(0);
  const sessionId = params.get("session_id");
  const isPaypal = params.get("paypal") === "1";
  const paypalToken = params.get("token"); // PayPal appends ?token=<order_id> on return

  useEffect(() => {
    let cancelled = false;

    // PayPal capture flow
    if (isPaypal && paypalToken) {
      (async () => {
        try {
          const { data } = await api.post(`/paypal/capture/${paypalToken}`);
          if (cancelled) return;
          if (data.status === "captured" || data.status === "already_captured") {
            setStatus("paid");
            toast.success("Welcome to Tony Yoga.");
            setTimeout(() => nav("/profile", { replace: true }), 1500);
          } else {
            setStatus("error");
          }
        } catch (e) {
          if (!cancelled) setStatus("error");
        }
      })();
      return () => { cancelled = true; };
    }

    // Stripe polling flow
    if (!sessionId) { setStatus("bad"); return; }
    const poll = async () => {
      try {
        const { data } = await api.get(`/checkout/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          setStatus("paid");
          toast.success("Welcome to Tony Yoga.");
          setTimeout(() => nav("/profile", { replace: true }), 1500);
          return;
        }
        if (data.status === "expired") { setStatus("expired"); return; }
        if (tries >= 8) { setStatus("timeout"); return; }
        setTimeout(() => setTries((n) => n + 1), 2000);
      } catch { if (!cancelled) setStatus("error"); }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, tries, nav, isPaypal, paypalToken]);

  return (
    <div data-testid="checkout-success">
      <PageHeader eyebrow="Membership" title="Confirming…" testId="checkout-success-header" />
      <div className="mx-auto max-w-md px-6 py-8 text-center">
        {status === "checking" && <Spinner label="Verifying with Stripe" />}
        {status === "paid" && (
          <div className="animate-fade-up">
            <CheckCircle2 className="h-14 w-14 text-[#839682] mx-auto mb-4" />
            <div className="serif text-2xl">You're in.</div>
            <p className="text-sm text-[#6B7269] mt-2">Redirecting to your profile…</p>
          </div>
        )}
        {(status === "error" || status === "bad" || status === "timeout") && (
          <>
            <div className="serif text-xl mb-2">Something didn't finish.</div>
            <p className="text-sm text-[#6B7269]">If you were charged, contact tony@tonysanchezyoga.com.</p>
            <Link to="/memberships" className="pill pill-ghost mt-6 inline-flex">Back to memberships</Link>
          </>
        )}
      </div>
    </div>
  );
}

export function CheckoutCancel() {
  return (
    <div data-testid="checkout-cancel">
      <PageHeader eyebrow="Membership" title="Payment cancelled." testId="checkout-cancel-header" />
      <div className="mx-auto max-w-md px-6 py-4 text-center">
        <XCircle className="h-14 w-14 text-[#B25A45] mx-auto mb-4" />
        <p className="text-sm text-[#6B7269] mb-6">No charge was made. Come back anytime.</p>
        <Link to="/memberships" className="pill pill-primary inline-flex">See plans again</Link>
      </div>
    </div>
  );
}
