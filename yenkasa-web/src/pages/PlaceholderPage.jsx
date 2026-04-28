import { useNavigate } from "react-router-dom";
import BottomNav from "../components/feed/BottomNav";

export default function PlaceholderPage({ title, subtitle }) {
  const navigate = useNavigate();

  return (
    <main className="page page--with-nav">
      <header className="post-details-header">
        <button
          type="button"
          className="post-details-header__back"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <div>
          <div className="page-header__eyebrow">Yenkasa Web</div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
      </header>
      <section className="empty-state">
        <h2>{title} is ready to wire next.</h2>
        <p className="muted">This route now opens in the centered web area instead of replacing the feed with a menu page.</p>
      </section>
      <BottomNav />
    </main>
  );
}
