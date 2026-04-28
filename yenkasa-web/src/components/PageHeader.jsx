import { Link, useNavigate } from "react-router-dom";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionTo,
  backTo = "/",
  showBack = false,
}) {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backTo, { replace: true });
  }

  return (
    <header className="page-header">
      <div className="page-header__row">
        {showBack ? (
          <button type="button" className="page-header__back" onClick={goBack} aria-label="Go back">
            ←
          </button>
        ) : null}
        <div>
          {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
          {actionLabel && actionTo ? (
            <Link className="ghost-link" to={actionTo}>
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
