import { Video, GraduationCap, Mountain, ShoppingBag, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

// -------- Feature Strip (4 tiles: Live · Programs · Retreats · Shop) --------
export function FeatureStrip() {
  const items = [
    { icon: Video, label: "Live Zoom", desc: "Classes with Tony every week", to: "/schedule" },
    { icon: GraduationCap, label: "Programs", desc: "Core 26+ · 40 · 84 on demand", to: "/programs" },
    { icon: Mountain, label: "Retreats", desc: "Sixteen students · Málaga", to: "/workshops" },
    { icon: ShoppingBag, label: "Shop", desc: "Mats, blocks, journals", to: "/shop" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12" data-testid="feature-strip">
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map(({ icon: Icon, label, desc, to }) => (
          <li key={label}>
            <Link to={to} className="block rounded-2xl bg-white border border-[#E5E6DF] hover:border-[#B25A45] transition p-4 sm:p-5">
              <Icon className="h-5 w-5 text-[#B25A45] mb-2" strokeWidth={1.8} />
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-[#6B7269] mt-1 leading-snug">{desc}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// -------- Stats Bar --------
export function StatsBar() {
  const stats = [
    ["50+", "years on the mat"],
    ["84", "postures"],
    ["3", "Core programs"],
    ["6 / week", "live classes"],
  ];
  return (
    <section className="border-y border-[#E5E6DF] bg-[#FAFAF7]" data-testid="stats-bar">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map(([n, l]) => (
          <div key={l} className="text-center md:text-left">
            <div className="serif text-3xl sm:text-4xl leading-none">{n}</div>
            <div className="eyebrow mt-2 !text-[10px]">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// -------- Three Value Props --------
export function ValueProps() {
  const props = [
    { n: "01", h: "Who teaches?", p: "Tony Sanchez, direct student of Bikram Choudhury and keeper of the Ghosh lineage. Fifty years teaching yoga precisely as it was taught to him." },
    { n: "02", h: "Why is it small?", p: "Small live classes and sixteen-student retreats. So Tony sees every posture, every breath, every student." },
    { n: "03", h: "What is ideal about it?", p: "Personalised. Progressive. Sustainable. A practice you return to for the rest of your life — not one you burn through and abandon." },
  ];
  return (
    <section className="bg-[#B25A45] text-[#FAFAF7] py-14 sm:py-20 lg:py-24" data-testid="value-props">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="serif text-3xl sm:text-4xl lg:text-5xl leading-tight mb-10 max-w-3xl">Personalised. Progressive. Sustainable.</h2>
        <ul className="grid md:grid-cols-3 gap-6 md:gap-10">
          {props.map((v) => (
            <li key={v.n}>
              <div className="serif text-4xl opacity-40">{v.n}</div>
              <div className="serif text-xl mt-3 mb-2">{v.h}</div>
              <p className="text-[15px] text-white/85 leading-relaxed">{v.p}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// -------- FAQ ("Before you begin") --------
const FAQS = [
  {
    q: "I'm a total beginner — is this for me?",
    a: "Yes. In fact, the beginner has an advantage — no habits to unlearn. Start with Core 26+ and come to a live class. I will meet you exactly where you are and give you the modifications you need. Every posture has a first step; we begin there.",
  },
  {
    q: "Do I need to attend the Zoom classes live?",
    a: "No. Live is warmer — you can ask questions, and I can correct you — but every class is added to your library within a day. Watch it once, watch it ten times. The practice does not mind.",
  },
  {
    q: "What's the difference between Core 26, 40 and 84?",
    a: "Core 26+ is the foundation Bikram gave to the world, with the two postures he later removed. Core 40 refines what 26+ builds — deeper breath, slower entry, more precise alignment. Core 84 is the full Ghosh system, drawn from what Bishnu Ghosh taught his students in Kolkata. It is for practitioners with at least three years on the mat.",
  },
  {
    q: "Can I cancel my membership at any time?",
    a: "Yes. One tap in your profile — that's it. Your access continues until the paid period ends. No emails, no forms, no explaining yourself. Come back whenever you want.",
  },
  {
    q: "Do retreats fill up quickly?",
    a: "The house in Málaga only holds sixteen — I keep it that small on purpose so I can watch every student every day. Most retreats fill three or four months ahead. The €500 deposit is fully refundable up to sixty days before we begin.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="bg-[#1C221F] text-[#FAFAF7] py-14 sm:py-20 lg:py-24" data-testid="marketing-faq">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="eyebrow !text-[#B25A45] mb-3">Common questions</div>
        <h2 className="serif text-3xl sm:text-4xl lg:text-5xl leading-tight mb-8 sm:mb-10">Before you begin.</h2>
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {FAQS.map((f, i) => (
            <li key={i}>
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                data-testid={`faq-toggle-${i}`}
                className="w-full flex items-center justify-between py-5 sm:py-6 text-left gap-4 hover:text-[#B25A45] transition"
              >
                <span className="serif text-base sm:text-lg">{f.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === i ? "rotate-180 text-[#B25A45]" : "text-white/60"}`} />
              </button>
              {open === i && (
                <div className="pb-6 text-white/70 text-[15px] leading-relaxed max-w-3xl">
                  {f.a}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
