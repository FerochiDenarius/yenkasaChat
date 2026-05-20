import { Activity, Bot, Database, Flag, Home, UploadCloud } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import BrandMark from "./BrandMark";

const navItems = [
  { to: "/ai/chat", label: "AI Chat", icon: Bot },
  { to: "/ai/knowledge", label: "Knowledge Base", icon: Database },
  { to: "/ai/moderation", label: "Moderation Console", icon: Flag },
  { to: "/ai/analytics", label: "System Analytics", icon: Activity },
  { to: "/ai/ingestion", label: "Upload & Ingestion", icon: UploadCloud },
];

export default function AiSidebar({ mobileOpen, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 transition-opacity lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`ai-glass ai-glass-strong fixed inset-y-4 left-4 z-50 flex w-[286px] flex-col rounded-[30px] p-5 transition-transform duration-200 lg:sticky lg:top-4 lg:z-20 lg:h-[calc(100vh-2rem)] ${mobileOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <Link to="/ai" className="min-w-0">
            <BrandMark />
          </Link>
          <button
            type="button"
            className="rounded-2xl border border-white/20 px-3 py-2 text-sm font-medium text-slate-600 lg:hidden dark:text-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-8 rounded-[26px] border border-white/40 bg-gradient-to-br from-ai-600 via-ai-500 to-blue-500 p-5 text-white shadow-glow">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Control Plane</p>
          <h3 className="mt-3 text-lg font-semibold tracking-tight">Engineering intelligence workspace</h3>
          <p className="mt-2 text-sm leading-6 text-white/80">
            RAG answers, moderation signals, ingestion health, and infrastructure analytics in one place.
          </p>
          <Link
            to="/ai"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/18 px-4 py-2 text-sm font-semibold text-white"
          >
            <Home className="h-4 w-4" />
            Launchpad
          </Link>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-ai-600 text-white shadow-glow"
                      : "text-slate-700 hover:bg-white/70 dark:text-slate-100 dark:hover:bg-white/5"
                  }`
                }
                onClick={onClose}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[26px] border border-white/40 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ai-700 dark:text-ai-200">Runtime</p>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="ai-muted">Generation</span>
              <span className="font-medium text-[var(--ai-text)]">Vertex AI</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="ai-muted">Retrieval</span>
              <span className="font-medium text-[var(--ai-text)]">Chroma + HF</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="ai-muted">State</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-300">Operational</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
