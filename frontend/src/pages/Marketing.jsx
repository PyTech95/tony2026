import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Download, Menu, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import InstagramReels from "@/components/InstagramReels";
import FreeClassRibbon from "@/components/FreeClassRibbon";
import Logo from "@/components/Logo";
import LanguageToggle from "@/components/LanguageToggle";
import InlineSignup from "@/components/InlineSignup";
import { FeatureStrip, StatsBar, ValueProps, FAQ } from "@/components/MarketingSections";
import HeroTestimonial from "@/components/HeroTestimonial";
import AssistantWidget from "@/components/AssistantWidget";

const HERO = "https://images.squarespace-cdn.com/content/v1/620bca2d082bbf5542408178/6b55c6a0-8c26-4670-8cb7-68a45f7371fb/TonySanchez-head-to-knee.png";

function isStandalone() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);
}

function Nav({ onOpenApp }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const items = [
    { href: "#story", label: t("marketing.nav_story") },
    { href: "#programs", label: t("marketing.nav_programs") },
    { href: "#retreats", label: t("marketing.nav_retreats") },
    { href: "#faq", label: t("marketing.nav_faq") },
    { href: "#join", label: t("marketing.nav_join") },
  ];
  return (
    <header
      data-testid="marketing-nav"
      className={`fixed inset-x-0 z-50 transition top-10 ${scrolled ? "bg-[#FAFAF7]/90 backdrop-blur-xl border-b border-[#E5E6DF]" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <a href="#top" className="flex items-center" data-testid="marketing-logo">
          <Logo className="h-12 w-12 sm:h-16 sm:w-16" />
        </a>
        <nav className="hidden lg:flex items-center gap-8" data-testid="marketing-nav-links">
          {items.map((i) => (
            <a key={i.href} href={i.href} className="text-sm text-[#545E56] hover:text-[#B25A45] transition">{i.label}</a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <LanguageToggle />
          <Link to="/login" data-testid="nav-signin" className="text-sm text-[#545E56] hover:text-[#B25A45] transition">{t("common.signIn")}</Link>
          <button onClick={onOpenApp} data-testid="nav-open-app" className="pill pill-primary !py-2 !px-4 !text-[13px]">
            {t("marketing.open_app")} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <button onClick={() => setOpen((o) => !o)} data-testid="nav-menu-toggle" className="lg:hidden h-9 w-9 rounded-full border border-[#E5E6DF] flex items-center justify-center">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden bg-[#FAFAF7] border-b border-[#E5E6DF] px-4 sm:px-6 py-4" data-testid="mobile-menu">
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.href}><a href={i.href} onClick={() => setOpen(false)} className="block py-2 text-[#1C221F] font-medium">{i.label}</a></li>
            ))}
            <li className="pt-2 border-t border-[#E5E6DF]">
              <Link to="/login" data-testid="mobile-nav-signin" className="block py-2 text-[#1C221F] font-medium">{t("common.signIn")}</Link>
            </li>
            <li className="pt-1"><LanguageToggle /></li>
            <li><button onClick={onOpenApp} data-testid="mobile-nav-open-app" className="pill pill-primary w-full mt-2">{t("marketing.open_app")} <ArrowRight className="h-4 w-4" /></button></li>
          </ul>
        </div>
      )}
    </header>
  );
}

function Hero({ onOpenApp }) {
  return (
    <section id="top" className="relative overflow-hidden pt-24 sm:pt-28 lg:pt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center lg:min-h-[80vh]">
        <div className="animate-fade-up order-2 lg:order-1">
          <div className="eyebrow mb-3 sm:mb-4">Tony Yoga · Ghosh Lineage · Est. 1986</div>
          <h1 className="serif text-4xl sm:text-5xl lg:text-7xl leading-[1.02] font-medium mb-4 sm:mb-6" data-testid="hero-title">
            Slow down.<br/>Breathe in.<br/><span className="text-[#B25A45]">Begin again.</span>
          </h1>
          <p className="text-base sm:text-lg text-[#545E56] leading-relaxed mb-6 sm:mb-8 max-w-md">
            Fifty years on the mat with Tony Sanchez. Live classes, on-demand programs, and small-group retreats in Málaga, Spain.
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <a href="#join" data-testid="hero-cta-signup" className="pill pill-primary">
              Create account <ArrowRight className="h-4 w-4" />
            </a>
            <button onClick={onOpenApp} data-testid="hero-cta-open-app" className="pill pill-ghost">
              <Download className="h-4 w-4" /> Open the app
            </button>
          </div>
          <div className="mt-8 sm:mt-10 flex items-center gap-6 sm:gap-8">
            {[["50+","years"],["3","programs"],["4","retreats"]].map(([n,l]) => (
              <div key={l}>
                <div className="serif text-2xl sm:text-3xl leading-none">{n}</div>
                <div className="eyebrow mt-1 !text-[10px]">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative animate-fade-up animate-delay-2 order-1 lg:order-2 max-w-md mx-auto lg:max-w-none w-full">
          <div className="relative aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F2F2EC]">
            <img src={HERO} alt="Tony Sanchez in head-to-knee pose" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 grain"></div>
          </div>
          <div className="hidden lg:block absolute -left-6 -bottom-6 w-52 rounded-2xl bg-[#1C221F] text-[#FAFAF7] p-5 shadow-2xl">
            <div className="eyebrow !text-[#B25A45]">Live now</div>
            <div className="text-sm mt-1 font-semibold">Ghosh 84 — Advanced Series</div>
            <div className="text-xs text-white/60 mt-1">6:00 AM · Málaga time</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section id="story" className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24 grid md:grid-cols-3 gap-8 md:gap-12">
      <div className="md:col-span-1">
        <div className="eyebrow mb-3">The story</div>
        <h2 className="serif text-3xl sm:text-4xl leading-tight">A lifetime<br/>on the mat.</h2>
      </div>
      <div className="md:col-span-2 space-y-5 sm:space-y-6 text-[#545E56] leading-relaxed">
        <p className="text-base sm:text-lg">
          Tony Sanchez has practiced yoga for over five decades. As a direct student of Bikram Choudhury in the 1970s and a keeper of the Ghosh lineage from Kolkata, Tony teaches yoga as it was taught to him: slowly, precisely, and with reverence for the breath.
        </p>
        <p>
          The Core Series — 26+, 40, and 84 — are Tony's contribution to the tradition. Each posture is broken down into detail unavailable anywhere else, refined across thousands of teaching hours in California, Mexico, and now Spain.
        </p>
        <p className="italic serif text-lg sm:text-xl text-[#1C221F]">
          "Yoga is not something you do. It is something you become."
        </p>
        <div className="pt-2 sm:pt-4">
          <a href="#programs" className="text-sm font-semibold text-[#B25A45] hover:underline">See the Core Series →</a>
        </div>
      </div>
    </section>
  );
}

function Programs() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/programs").then(({ data }) => setRows(data)).catch(() => {}); }, []);
  return (
    <section id="programs" className="bg-[#1C221F] text-[#FAFAF7] py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-lg mb-8 sm:mb-12">
          <div className="eyebrow !text-[#B25A45] mb-3">On demand</div>
          <h2 className="serif text-3xl sm:text-4xl leading-tight mb-4">The Core Series — three programs, one lineage.</h2>
          <p className="text-white/70 leading-relaxed text-sm sm:text-base">Lifetime access. Watch anywhere. Return to any lesson as often as you need.</p>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" data-testid="marketing-programs">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                to={`/programs/${p.id}`}
                data-testid={`marketing-program-${p.id}`}
                className="group block h-full rounded-3xl overflow-hidden bg-[#0F1211] border border-white/10 transition-all duration-300 hover:border-[#B25A45] hover:-translate-y-1"
              >
                {p.cover_image && (
                  <div className="aspect-[4/5] overflow-hidden">
                    <img src={p.cover_image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                )}
                <div className="p-6">
                  <div className="eyebrow !text-[#B25A45]">{p.level}</div>
                  <div className="serif text-2xl mt-1">{p.title}</div>
                  <div className="text-xs text-white/60 mt-2">{p.duration_weeks} weeks · €{Math.round(p.price)}</div>
                  <p className="text-sm text-white/70 mt-4 clamp-3 leading-relaxed">{p.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#B25A45]">
                    View program <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Retreats() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/workshops").then(({ data }) => setRows((data || []).slice(0, 2))).catch(() => {}); }, []);
  return (
    <section id="retreats" className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
      <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-end mb-8 sm:mb-12">
        <div>
          <div className="eyebrow mb-3">Retreats</div>
          <h2 className="serif text-3xl sm:text-4xl leading-tight">Málaga, Spain.<br/>Sixteen students. One week.</h2>
        </div>
        <p className="text-[#545E56] leading-relaxed text-sm sm:text-base">
          Small-group retreats in Andalusia. Two-a-day practice, breakfast on the terrace, deep instruction in Ghosh 84. Reserve a seat with a deposit — balance due 30 days before the retreat begins.
        </p>
      </div>
      <ul className="grid md:grid-cols-2 gap-4 sm:gap-6" data-testid="marketing-retreats">
        {rows.map((w) => (
          <li key={w.id}>
            <Link
              to={`/workshops/${w.id}`}
              data-testid={`marketing-retreat-${w.id}`}
              className="group block h-full rounded-3xl overflow-hidden bg-white border border-[#E5E6DF] transition-all duration-300 hover:border-[#B25A45] hover:-translate-y-1"
            >
              {w.cover_image && (
                <div className="aspect-[16/10] overflow-hidden bg-[#F2F2EC]">
                  <img src={w.cover_image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="p-6">
                <div className="eyebrow">{w.system}</div>
                <div className="serif text-2xl mt-1 leading-tight">{w.title}</div>
                <p className="text-sm text-[#6B7269] mt-2 leading-relaxed clamp-2">{w.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-[#545E56]">{new Date(w.start_date).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                  <div className="text-[#B25A45] font-semibold">€{w.deposit_eur ?? 500} deposit</div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TESTIMONIALS = [
  {
    quote: "Tony's instruction is unlike anything I've received. He knows every muscle. Twenty years of practice and I've never gone this deep.",
    author: "María Castillo",
    role: "Student, Madrid",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
  },
  {
    quote: "The Core 84 program rebuilt my back after a spinal injury. I can't imagine my life without this practice.",
    author: "James Ridley",
    role: "Perpetual Yogi, Los Angeles",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
  },
  {
    quote: "A week in Málaga with Tony reset everything. I came home a different teacher — and a different person.",
    author: "Sofia Larsen",
    role: "Yoga Instructor, Barcelona",
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces",
  },
];

function Testimonials() {
  return (
    <section id="testimonials" className="bg-[#F2F2EC] py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-lg mb-8 sm:mb-12">
          <div className="eyebrow mb-3">Students, past & present</div>
          <h2 className="serif text-3xl sm:text-4xl leading-tight">Twenty thousand hours of teaching. A few thousand grateful students.</h2>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" data-testid="marketing-testimonials">
          {TESTIMONIALS.map((t, i) => (
            <li key={i} className="rounded-2xl sm:rounded-3xl bg-[#FAFAF7] p-6 sm:p-8 flex flex-col">
              <div className="serif text-4xl text-[#B25A45] leading-none">"</div>
              <p className="text-[15px] text-[#1C221F] leading-relaxed mt-3 flex-1">{t.quote}</p>
              <div className="mt-6 pt-4 border-t border-[#E5E6DF] flex items-center gap-3">
                <div className="h-11 w-11 rounded-full overflow-hidden bg-[#F2F2EC] shrink-0">
                  <img src={t.photo} alt={t.author} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{t.author}</div>
                  <div className="text-xs text-[#6B7269] mt-0.5 truncate">{t.role}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AppCTA({ onOpenApp }) {
  const features = [
    "Live classes with Tony from anywhere",
    "Full Core 26+/40/84 on demand",
    "Class reminders 30 min before",
    "Track streaks · celebrate milestones",
    "Book retreats with a small deposit",
    "Cancel anytime",
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
      <div className="rounded-2xl sm:rounded-3xl bg-[#1C221F] text-[#FAFAF7] p-6 sm:p-10 lg:p-16 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
        <div>
          <div className="eyebrow !text-[#B25A45] mb-3">Practice anywhere</div>
          <h2 className="serif text-3xl sm:text-4xl lg:text-5xl leading-tight mb-4">Your mat.<br/>In your pocket.</h2>
          <p className="text-white/70 leading-relaxed mb-6 max-w-md text-sm sm:text-base">Install Tony Yoga to your home screen — it opens like a native app, works offline, and pings you before every class.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onOpenApp} data-testid="cta-open-app-primary" className="pill !bg-[#B25A45] !text-white">
              <Download className="h-4 w-4" /> Open the app
            </button>
            <span className="text-xs text-white/50 self-center">iOS · Android · Desktop</span>
          </div>
        </div>
        <ul className="space-y-3" data-testid="app-features">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <div className="mt-0.5 h-5 w-5 rounded-full bg-[#B25A45] flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-white" />
              </div>
              <span className="text-white/85">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  const [email, setEmail] = useState("");
  const [subbed, setSubbed] = useState(false);
  const subscribe = async (e) => {
    e.preventDefault();
    try {
      await api.post("/submissions/newsletter", { email });
      setSubbed(true);
    } catch { setSubbed(true); }
  };
  return (
    <footer className="bg-[#1C221F] text-[#FAFAF7] py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid md:grid-cols-2 gap-8 md:gap-10">
        <div>
          <div className="mb-4">
            <Logo className="h-20 w-20 sm:h-24 sm:w-24" />
          </div>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            Málaga, Spain. Ghosh lineage. Since 1986 — fifty years of practice, offered gently.
          </p>
          <a href="mailto:tony@tonysanchezyoga.com" className="text-sm text-[#B25A45] hover:underline mt-4 inline-block">tony@tonysanchezyoga.com</a>
        </div>
        <div>
          <div className="eyebrow !text-[#B25A45] mb-3">Stay in touch</div>
          <p className="text-sm text-white/60 mb-4">Rare, thoughtful notes on practice. No spam.</p>
          {subbed ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/80" data-testid="footer-newsletter-thanks">
              Thank you. Look for our first note soon.
            </div>
          ) : (
            <form onSubmit={subscribe} className="flex gap-2" data-testid="footer-newsletter-form">
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="footer-newsletter-email"
                placeholder="you@example.com"
                className="flex-1 rounded-full bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#B25A45]"
              />
              <button type="submit" data-testid="footer-newsletter-submit" className="pill !bg-[#B25A45] !text-white !py-2 !px-4 !text-[13px]">Subscribe</button>
            </form>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-8 sm:mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-white/40">© {new Date().getFullYear()} Tony Yoga. All rights reserved.</div>
        <div className="flex items-center gap-5 text-xs">
          <Link to="/home" className="text-white/60 hover:text-white transition">Student sign-in</Link>
          <Link to="/login?admin=1" data-testid="footer-admin-signin" className="text-white/60 hover:text-[#B25A45] transition">Admin sign-in</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Marketing() {
  const openApp = () => {
    // If already installed as PWA, go to home; else route into the app shell.
    window.location.href = isStandalone() ? "/home" : "/home";
  };
  useEffect(() => {
    document.title = "Tony Yoga — Slow down. Breathe in. Begin again.";
  }, []);
  return (
    <div data-testid="marketing-site" className="min-h-screen bg-[#FAFAF7]">
      <FreeClassRibbon />
      <Nav onOpenApp={openApp} />
      <Hero onOpenApp={openApp} />
      <FeatureStrip />
      <StatsBar />
      <Story />
      <ValueProps />
      <Programs />
      <Retreats />
      <HeroTestimonial />
      <Testimonials />
      <InlineSignup />
      <FAQ />
      <AppCTA onOpenApp={openApp} />
      <InstagramReels />
      <Footer />
      <AssistantWidget />
    </div>
  );
}
