export default function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <span className="mb-3 inline-flex rounded-full border border-ai-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ai-700 dark:border-white/10 dark:bg-white/5 dark:text-ai-200">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--ai-text)] sm:text-3xl">{title}</h2>
        {description ? <p className="ai-muted mt-3 max-w-2xl text-sm sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
