import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, getStoredUser } from "../../utils/storage";
import "../../styles/layout.css";

const menuItems = [
  { icon: "◌", title: "My Ads", subtitle: "Track your sponsored posts", to: "/ads" },
  { icon: "◔", title: "Notifications", subtitle: "View account alerts", to: "/notifications" },
  { icon: "⚙", title: "Settings", subtitle: "Privacy and preferences", to: "/settings" },
  { icon: "✓", title: "Post Approvals", subtitle: "Review pending posts", to: "/post-approvals", reviewOnly: true },
  { icon: "◎", title: "Approve Ads", subtitle: "Review sponsored ads", to: "/approve-ads", reviewOnly: true },
  { icon: "◈", title: "Approve Communities", subtitle: "Review community requests", to: "/approve-communities", reviewOnly: true },
];

const reviewerRoles = new Set([
  "admin",
  "moderator",
  "junior_developer",
  "senior_developer",
]);

export default function SideDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser() || {}, []);
  const canReview = reviewerRoles.has(normalizeRole(user));
  const visibleItems = menuItems.filter((item) => !item.reviewOnly || canReview);

  function goTo(path) {
    onClose?.();
    navigate(path);
  }

  function logout() {
    clearAuth();
    onClose?.();
    navigate("/login", { replace: true });
  }

  return (
    <aside className={`side-drawer${open ? " side-drawer--open" : ""}`} aria-hidden={!open}>
      <header className="side-drawer__header">
        <div className="side-drawer__brand">
          <img src="/images/yenkasa_web_assets/yenkasa_logo.png" alt="Yenkasa" />
          <div>
            <strong>Yenkasa</strong>
            <span>Secure. Connect. Earn.</span>
          </div>
        </div>
        <button type="button" className="side-drawer__close" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </header>

      <nav className="side-drawer__nav" aria-label="Menu">
        {visibleItems.map((item) => (
          <button
            type="button"
            className="side-drawer__item"
            key={item.title}
            onClick={() => goTo(item.to)}
          >
            <span className="side-drawer__item-icon">{item.icon}</span>
            <span className="side-drawer__item-copy">
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
          </button>
        ))}
      </nav>

      <button type="button" className="side-drawer__item side-drawer__item--logout" onClick={logout}>
        <span className="side-drawer__item-icon">⇠</span>
        <span className="side-drawer__item-copy">
          <strong>Logout</strong>
          <small>Sign out from Yenkasa</small>
        </span>
      </button>
    </aside>
  );
}

function normalizeRole(user) {
  const raw = user?.roleName || user?.role?.role || user?.role || "";
  return String(raw).trim().toLowerCase();
}
