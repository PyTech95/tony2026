import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      toast.success("Welcome back.");
      nav("/home");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (kind) => {
    if (kind === "admin") { setEmail("tony@tonyyoga.com"); setPassword("TonyYoga2026!"); }
    else { setEmail("student@demo.com"); setPassword("Student2026!"); }
  };

  const forgot = async () => {
    if (!email.trim()) return toast.error("Enter your email first, then tap 'Forgot password'.");
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      toast.success("If that email exists, a reset link is on its way.");
    } catch { toast.error("Could not start password reset."); }
  };

  const magicLink = async () => {
    if (!email.trim()) return toast.error("Enter your email first, then tap 'Email me a magic link'.");
    try {
      const { data } = await api.post("/auth/magic-link/request", { email: email.trim(), type: "login" });
      if (data.magic_url) {
        // Email delivery is off — open the link directly so the flow still works.
        toast.success("Opening your magic link…");
        nav(data.magic_url.replace(/^https?:\/\/[^/]+/, ""));
      } else {
        toast.success("Check your inbox for a sign-in link.");
      }
    } catch { toast.error("Could not send magic link."); }
  };

  return (
    <div data-testid="login-page">
      <PageHeader eyebrow="Tony Yoga · Since 1986" title="Sign in." back testId="login-header" showLogo />
      <form onSubmit={submit} className="mx-auto max-w-md px-6 mt-4 space-y-4">
        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            data-testid="login-email"
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
            data-testid="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-2xl border border-[#E5E6DF] bg-white px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B25A45] focus:border-transparent"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="login-remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-[#C9CBBF] text-[#B25A45] focus:ring-[#B25A45]"
          />
          <span className="text-[13px] text-[#545E56]">Keep me signed in</span>
        </label>

        <button
          type="submit"
          disabled={busy}
          data-testid="login-submit"
          className="pill pill-primary w-full mt-2"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-[13px] text-[#6B7269]">
          New here?{" "}
          <Link to="/register" data-testid="login-link-register" className="underline text-[#1C221F]">Create an account</Link>
        </p>

        <div className="flex items-center justify-center gap-4 text-[13px]">
          <button type="button" onClick={forgot} data-testid="login-forgot" className="text-[#B25A45] hover:underline">Forgot password?</button>
          <span className="text-[#D8D9D1]">·</span>
          <button type="button" onClick={magicLink} data-testid="login-magic-link" className="text-[#B25A45] hover:underline">Email me a magic link</button>
        </div>

        <div className="mt-8 rounded-2xl bg-[#F2F2EC] p-4 text-[12px] leading-relaxed text-[#545E56]">
          <div className="eyebrow mb-2 !text-[#B25A45]">Demo access</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="login-demo-student" onClick={() => fillDemo("student")} className="pill pill-ghost !py-1.5 !px-3 !text-xs">student@demo.com</button>
            <button type="button" data-testid="login-demo-admin" onClick={() => fillDemo("admin")} className="pill pill-ghost !py-1.5 !px-3 !text-xs">tony@tonyyoga.com</button>
          </div>
        </div>
      </form>
    </div>
  );
}
