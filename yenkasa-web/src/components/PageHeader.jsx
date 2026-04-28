import { Link } from "react-router-dom";

export default function PageHeader({ eyebrow, title, subtitle, actionLabel, actionTo }) {
  return (
    <header className="page-header">
      {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actionLabel && actionTo ? (
        <Link className="ghost-link" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </header>
  );
}
