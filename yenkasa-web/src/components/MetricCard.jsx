export default function MetricCard({ label, value, helper }) {
  return (
    <div className="metric-card">
      <p className="metric-card__label">{label}</p>
      <h3 className="metric-card__value">{value}</h3>
      {helper ? <p className="metric-card__helper">{helper}</p> : null}
    </div>
  );
}
