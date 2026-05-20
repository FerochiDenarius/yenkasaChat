import GlassCard from "./GlassCard";

const toneClasses = {
  success: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-rose-600 dark:text-rose-300",
  neutral: "text-ai-700 dark:text-ai-200",
};

export default function StatCard({ label, value, note, tone = "neutral" }) {
  return (
    <GlassCard className="p-5" hover>
      <p className="ai-subtle text-xs font-medium uppercase tracking-[0.16em]">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <span className={`text-3xl font-semibold tracking-tight ${toneClasses[tone] || toneClasses.neutral}`}>
          {value}
        </span>
      </div>
      {note ? <p className="ai-muted mt-3 text-sm leading-6">{note}</p> : null}
    </GlassCard>
  );
}
