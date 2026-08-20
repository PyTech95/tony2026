import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { api, tokenStore } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Inline registration form for the marketing site homepage. */
export default function InlineSignup() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", form);
      tokenStore.set(data.token);
      await refresh();
      toast.success("Welcome. Your practice begins here.");
      nav("/home");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create account");
    } finally { setBusy(false); }
  };
  return (
    <section id="join" className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24" data-testid="marketing-signup">
      <div className="rounded-2xl sm:rounded-3xl bg-[#F2F2EC] p-6 sm:p-10 lg:p-14 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div>
          <div className="eyebrow mb-3">Join the practice</div>
          <h2 className="serif text-3xl sm:text-4xl leading-tight mb-3">Create your account.</h2>
          <p className="text-[#545E56] leading-relaxed max-w-md text-sm sm:text-base">
            Your first class is on us. One credit is added the moment you sign up — book any live class in the schedule.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[#1C221F]">
            {["First class free","Cancel anytime","Full Core 26+/40/84 preview"].map(x => <li key={x}>· {x}</li>)}
          </ul>
        </div>
        <form onSubmit={submit} className="space-y-3" data-testid="signup-form">
          <input required data-testid="signup-name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Your name" className="w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
          <input required type="email" data-testid="signup-email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="Email" className="w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
          <input required type="password" minLength={8} data-testid="signup-password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="Password (min 8 chars)" className="w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45]" />
          <button type="submit" disabled={busy} data-testid="signup-submit" className="pill pill-primary w-full">
            {busy ? "Creating account…" : "Create account"} <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-[11px] text-[#6B7269] text-center">By continuing you agree to Tony Yoga's terms & privacy.</p>
        </form>
      </div>
    </section>
  );
}
