import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Youtube, Package, GraduationCap, Calendar, ClipboardCheck, Mic, MountainSnow, Gift, Settings as SettingsIcon, Upload, ChevronRight, Flower2, Sparkles, ShoppingBag, Truck } from "lucide-react";
import StatsPane from "./admin/StatsPane";
import CoursesPane from "./admin/CoursesPane";
import BundlesPane from "./admin/BundlesPane";
import StudentsPane from "./admin/StudentsPane";
import ClassesPane from "./admin/ClassesPane";
import ApplicationsPane from "./admin/ApplicationsPane";
import BroadcastPane from "./admin/BroadcastPane";
import RetreatsPane from "./admin/RetreatsPane";
import GiftCardsPane from "./admin/GiftCardsPane";
import SettingsPane from "./admin/SettingsPane";
import ImportPane from "./admin/ImportPane";
import AsanasPane from "./admin/AsanasPane";
import MeditationsPane from "./admin/MeditationsPane";
import ProductsPane from "./admin/ProductsPane";
import OrdersPane from "./admin/OrdersPane";

const ADMIN_NAV = [
  { key: "stats", label: "Overview", icon: LayoutDashboard },
  { key: "courses", label: "Courses & Videos", icon: Youtube },
  { key: "asanas", label: "Asana Index", icon: Flower2 },
  { key: "meditations", label: "Meditation & Breath", icon: Sparkles },
  { key: "shop", label: "Shop & Printful", icon: ShoppingBag },
  { key: "orders", label: "Orders & Fulfillment", icon: Truck },
  { key: "bundles", label: "Bundles", icon: Package },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "classes", label: "Classes", icon: Calendar },
  { key: "apps", label: "Applications", icon: ClipboardCheck },
  { key: "broadcast", label: "Broadcast", icon: Mic },
  { key: "retreats", label: "Retreats", icon: MountainSnow },
  { key: "giftcards", label: "Gift Cards", icon: Gift },
  { key: "settings", label: "Settings", icon: SettingsIcon },
  { key: "import", label: "Import", icon: Upload },
];

function AdminNavItem({ active, onClick, tid, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      data-testid={tid}
      className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors shrink-0 md:w-full ${
        active
          ? "bg-[#1C221F] text-[#FAFAF7]"
          : "text-[#545E56] hover:bg-[#F2F2EC]"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#E0A38F]" : "text-[#9AA096] group-hover:text-[#B25A45]"}`} strokeWidth={1.7} />
      <span>{children}</span>
    </button>
  );
}


export default function Admin() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const validTabs = ["stats", "courses", "asanas", "meditations", "shop", "orders", "bundles", "students", "classes", "apps", "broadcast", "retreats", "giftcards", "settings", "import"];
  const initialTab = validTabs.includes(params.get("tab")) ? params.get("tab") : "stats";
  const [tab, setTab] = useState(initialTab);
  const selectTab = (t) => { setTab(t); setParams(t === "stats" ? {} : { tab: t }, { replace: true }); };
  if (!ready) return null;
  if (!user || user.role !== "admin") return <Navigate to="/home" replace />;

  return (
    <div data-testid="admin-page" className="pb-6">
      <header className="safe-top px-5 pt-6 pb-2">
        <div className="mx-auto max-w-6xl">
          <div className="eyebrow mb-2">Admin</div>
          <h1 className="serif text-4xl sm:text-5xl font-medium" data-testid="admin-header">Console</h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 mt-4 md:flex md:gap-8 md:items-start">
        {/* Sidebar — vertical on desktop, horizontal scroll on mobile */}
        <aside className="md:w-60 md:shrink-0">
          <div className="relative">
            <nav
              data-testid="admin-tabs"
              className="flex md:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0 md:sticky md:top-6 md:rounded-2xl md:bg-white md:border md:border-[#E5E6DF] md:p-2"
            >
              {ADMIN_NAV.map((item) => (
                <AdminNavItem
                  key={item.key}
                  active={tab === item.key}
                  onClick={() => selectTab(item.key)}
                  tid={`admin-tab-${item.key}`}
                  icon={item.icon}
                >
                  {item.label}
                </AdminNavItem>
              ))}
            </nav>
            {/* scroll affordance on mobile — fade + chevron cue that there are more tabs */}
            <div className="md:hidden pointer-events-none absolute inset-y-0 right-0 flex items-center pl-8 pr-1 bg-gradient-to-l from-[#FAFAF7] via-[#FAFAF7] to-transparent">
              <ChevronRight className="h-4 w-4 text-[#B25A45] animate-pulse" strokeWidth={2.2} />
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 pt-5 md:pt-0">
          {tab === "stats" && <StatsPane />}
          {tab === "courses" && <CoursesPane />}
          {tab === "asanas" && <AsanasPane />}
          {tab === "meditations" && <MeditationsPane />}
          {tab === "shop" && <ProductsPane />}
          {tab === "orders" && <OrdersPane />}
          {tab === "bundles" && <BundlesPane />}
          {tab === "students" && <StudentsPane />}
          {tab === "classes" && <ClassesPane />}
          {tab === "apps" && <ApplicationsPane />}
          {tab === "broadcast" && <BroadcastPane />}
          {tab === "retreats" && <RetreatsPane />}
          {tab === "giftcards" && <GiftCardsPane />}
          {tab === "settings" && <SettingsPane />}
          {tab === "import" && <ImportPane />}
        </main>
      </div>
    </div>
  );
}
