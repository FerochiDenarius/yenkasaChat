import { Link, useNavigate } from "react-router-dom";

export default function TopBar() {
  const navigate = useNavigate();

  return (
    <header className="feed-topbar">
      <button className="feed-icon-btn" type="button" aria-label="Open menu" onClick={() => navigate("/menu")}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>

      <div className="feed-brand">
        <img
          src="/images/yenkasa_web_assets/yenkasa_logo.png"
          alt="Yenkasa"
          className="feed-brand__logo"
        />
        <span>Yenkasa</span>
      </div>

      <div className="feed-topbar__actions">
        <button className="feed-icon-btn feed-icon-btn--notify" type="button" aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4a4 4 0 0 0-4 4v2.4c0 .7-.2 1.4-.6 2L6 14.5h12l-1.4-2.1a3.8 3.8 0 0 1-.6-2V8a4 4 0 0 0-4-4Z" />
            <path d="M10 18a2 2 0 0 0 4 0" />
          </svg>
          <span className="feed-topbar__dot" />
        </button>

        <Link className="feed-create-ad" to="/ads">
          <span className="feed-create-ad__plus">+</span>
          <span>Create Ad</span>
        </Link>
      </div>
    </header>
  );
}
