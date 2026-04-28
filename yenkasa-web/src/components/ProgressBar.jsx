export default function ProgressBar({ value = 0, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="progress-block">
      {label ? (
        <div className="progress-block__label-row">
          <span>{label}</span>
          <strong>{safeValue}%</strong>
        </div>
      ) : null}
      <div className="progress-block__track">
        <div className="progress-block__fill" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
