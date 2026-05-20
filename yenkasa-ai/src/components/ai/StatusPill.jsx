const toneClasses = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200",
  neutral: "bg-white/80 text-slate-700 dark:bg-white/10 dark:text-slate-100",
};

export default function StatusPill({ children, tone = "neutral" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone] || toneClasses.neutral}`}
    >
      {children}
    </span>
  );
}
