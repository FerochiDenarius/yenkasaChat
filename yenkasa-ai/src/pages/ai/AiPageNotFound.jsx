import { Link } from "react-router-dom";
import GlassCard from "../../components/ai/GlassCard";

export default function AiPageNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <GlassCard className="max-w-xl rounded-[32px] p-8 text-center" strong>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ai-text)]">Route not found</h1>
        <p className="ai-muted mt-4 text-sm leading-7">
          The YenkasaAI route you requested does not exist yet. Return to the launchpad or open the main chat dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-2xl bg-gradient-to-r from-ai-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-glow"
          >
            Go to launchpad
          </Link>
          <Link
            to="/chat"
            className="rounded-2xl border border-white/40 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            Open AI chat
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
