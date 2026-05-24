import { AlertCircle, ArrowUpRight, Loader2 } from "lucide-react";

export function YmeCard({ children, className = "", strong = false }) {
  const base = strong
    ? "bg-[rgba(13,15,25,0.96)] border-white/10 shadow-[0_28px_80px_rgba(0,0,0,0.45)]"
    : "bg-[rgba(14,16,28,0.82)] border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

  return (
    <section
      className={`rounded-[28px] border backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 ${base} ${className}`}
    >
      {children}
    </section>
  );
}

export function YmeCardHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-white sm:text-[16px]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function YmeMetricCard({ label, value, note, icon: Icon, tone = "purple" }) {
  const toneClass =
    tone === "cyan"
      ? "from-cyan-400/25 to-blue-500/10 text-cyan-300"
      : tone === "green"
        ? "from-emerald-400/25 to-green-500/10 text-emerald-300"
        : tone === "amber"
          ? "from-amber-400/25 to-orange-500/10 text-amber-300"
          : "from-fuchsia-400/25 to-purple-500/10 text-violet-300";
  const noteClass =
    tone === "cyan"
      ? "text-cyan-300"
      : tone === "green"
        ? "text-emerald-300"
        : tone === "amber"
          ? "text-amber-200"
          : "text-violet-300";

  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(20,23,38,0.88)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
          {note ? <p className={`mt-2 text-sm font-medium ${noteClass}`}>{note}</p> : null}
        </div>
        {Icon ? (
          <div className={`rounded-2xl bg-gradient-to-br p-3 ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function YmeBadge({ children, tone = "neutral" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
        : tone === "danger"
          ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
          : tone === "purple"
            ? "border-violet-400/20 bg-violet-400/10 text-violet-200"
            : "border-white/10 bg-white/5 text-slate-300";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

export function YmePill({ children, active = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-violet-400/25 bg-violet-400/12 text-violet-200"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {children}
    </span>
  );
}

export function YmeProgressRow({ label, value = 0, percent = 0, tone = "violet" }) {
  const toneClass =
    tone === "cyan"
      ? "from-cyan-400 to-blue-500"
      : tone === "green"
        ? "from-emerald-400 to-green-500"
        : tone === "amber"
          ? "from-amber-400 to-orange-500"
          : "from-violet-400 to-fuchsia-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5">
        <div className={`h-full rounded-full bg-gradient-to-r ${toneClass}`} style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

export function YmeList({ items = [], emptyLabel = "No data yet.", renderItem }) {
  if (!items.length) {
    return (
      <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
        <AlertCircle className="h-4 w-4" />
        {emptyLabel}
      </div>
    );
  }

  return <div className="space-y-3">{items.map((item, index) => renderItem(item, index))}</div>;
}

export function YmeLoadingState({ label = "Loading YME data..." }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/10 bg-[rgba(14,16,28,0.82)]">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
        {label}
      </div>
    </div>
  );
}

export function YmeEmptyState({ title, description, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-400">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function YmeExternalLink({ children, href = "#", className = "" }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-white/[0.08] ${className}`}
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}
