import { Link } from "react-router-dom";

export default function MenuItem({ icon, title, subtitle, to, onClick, accent = "green", danger = false }) {
  const className = `menu-item${danger ? " menu-item--danger" : ""}`;

  const content = (
    <>
      <span className={`menu-item__icon menu-item__icon--${accent}`} aria-hidden="true">
        {icon}
      </span>
      <span className="menu-item__copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </span>
      <span className="menu-item__chevron" aria-hidden="true">›</span>
    </>
  );

  if (to) {
    return (
      <Link className={className} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button className={className} type="button" onClick={onClick}>
      {content}
    </button>
  );
}
