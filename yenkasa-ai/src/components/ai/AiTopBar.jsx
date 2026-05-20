import { Bell, Menu, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function AiTopBar({ theme, onToggleTheme, onOpenSidebar }) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="ai-glass h-11 w-11 rounded-2xl text-slate-700 lg:hidden dark:text-slate-100"
          aria-label="Open AI navigation"
        >
          <Menu className="mx-auto h-5 w-5" />
        </button>
        <div className="ai-glass flex min-w-0 flex-1 items-center gap-3 rounded-[24px] px-4 py-3 lg:min-w-[420px]">
          <Search className="h-4 w-4 text-ai-600 dark:text-ai-200" />
          <input
            type="search"
            placeholder="Search sources, incidents, routes, or ingestion jobs"
            className="w-full border-0 bg-transparent text-sm text-[var(--ai-text)] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/ai/ingestion"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-ai-600 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-glow"
        >
          <Sparkles className="h-4 w-4" />
          Queue ingestion
        </Link>
        <button
          type="button"
          className="ai-glass inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-medium text-slate-700 dark:text-slate-100"
        >
          <Bell className="h-4 w-4" />
          4 alerts
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
