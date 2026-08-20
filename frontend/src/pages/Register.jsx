import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api, tokenStore } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

export default function Register() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const refCode = params.get("ref") || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (refCode) toast(`Invited by a friend — first class free.`);
  }, [refCode]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        referral_code: refCode || undefined,
      });
      tokenStore.set(data.token);
      await refresh();
      toast.success("Welcome. Your practice begins here.");
      nav("/home");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="register-page">
      <PageHeader eyebrow={refCode ? "Invited · first class free" : "Tony Yoga · Since 1986"} title="Begin." back testId="register-header" showLogo />
      <form onSubmit={submit} className="mx-auto max-w-md px-6 mt-4 space-y-4">
        <label className="block">
          <span className="eyebrow">Your name</span>
          <input
            data-testid="register-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-2 w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45] focus:border-transparent"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            data-testid="register-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-2 w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45] focus:border-transparent"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Password</span>
          <input
            type="password"
            data-testid="register-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-2 w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45] focus:border-transparent"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          data-testid="register-submit"
          className="pill pill-primary w-full mt-2"
        >
          {busy ? "Creating…" : "Create account"}
        </button>

        <p className="text-center text-[13px] text-[#6B7269]">
          Already have an account?{" "}
          <Link to="/login" data-testid="register-link-login" className="underline text-[#1C221F]">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
