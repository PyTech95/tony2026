// Simple client-side dictionary for i18n:* keys emitted by the backend seed
const DICT = {
  "i18n:memb.plan.essential.name": "Essential",
  "i18n:memb.plan.essential.desc": "Online-only membership. Two live classes a week + full on-demand library + one program included.",
  "i18n:memb.plan.unlimited.name": "Unlimited",
  "i18n:memb.plan.unlimited.desc": "Everything Essential plus unlimited live classes (online + in-studio), all programs, 10 workshops/year and private-session discount.",
  "i18n:memb.plan.annual.name": "Annual VIP",
  "i18n:memb.plan.annual.desc": "One year, everything included, plus offline downloads and priority support. Best value.",
  "i18n:memb.feat.live_2pw": "2 live classes / week",
  "i18n:memb.feat.live_unlimited": "Unlimited live classes",
  "i18n:memb.feat.library_full": "Full on-demand library",
  "i18n:memb.feat.programs_one": "1 program included",
  "i18n:memb.feat.programs_all": "All programs included",
  "i18n:memb.feat.workshops_10": "10 workshops / year",
  "i18n:memb.feat.workshops_20": "20 workshops / year",
  "i18n:memb.feat.private_disc": "Private session discount",
  "i18n:memb.feat.community": "Community access",
  "i18n:memb.feat.cancel_any": "Cancel anytime",
  "i18n:memb.feat.priority_support": "Priority support",
  "i18n:memb.feat.offline_downloads": "Offline downloads",
};

export const t = (key) => (typeof key === "string" && key.startsWith("i18n:") ? DICT[key] || key.slice(5) : key);
