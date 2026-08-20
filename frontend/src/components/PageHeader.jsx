import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";

export default function PageHeader({ title, eyebrow, action, back = false, testId, showLogo = false }) {
  const nav = useNavigate();
  return (
    <header className="safe-top px-5 pt-6 pb-4" data-testid={testId}>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          {back ? (
            <button
              onClick={() => nav(-1)}
              data-testid="header-back"
              className="rounded-full p-2 -ml-2 hover:bg-[#F2F2EC] transition"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.6} />
            </button>
          ) : showLogo ? <Logo className="h-14 w-14 sm:h-16 sm:w-16" /> : <span />}
          {action}
        </div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        {title && <h1 className="serif text-4xl sm:text-5xl font-medium">{title}</h1>}
      </div>
    </header>
  );
}
