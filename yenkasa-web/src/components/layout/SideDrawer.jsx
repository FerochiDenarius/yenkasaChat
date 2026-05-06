import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile } from "../../api/profile";
import { handleStaticImageError, staticImage } from "../../utils/images";
import { canAccessAnalytics, canModerate, getPermissions, getUserRank } from "../../utils/permissions";
import { clearAuth, getStoredUser, updateStoredUser } from "../../utils/storage";
import "../../styles/layout.css";

const menuItems = [
  { icon: "◉", title: "Contacts", subtitle: "Manage saved contacts", to: "/contacts" },
  { icon: "□", title: "Chat Rooms", subtitle: "View all your chats", to: "/chatrooms" },
  { icon: "♙", title: "Account Info", subtitle: "Your account details", to: "/profile" },
  { icon: "▣", title: "Wallet", subtitle: "Your YKC balance", to: "/wallet" },
  { icon: "✎", title: "Edit Profile", subtitle: "Update your profile", to: "/edit-profile" },
  { icon: "✓", title: "Verify Account", subtitle: "Verification options", to: "/verify-account" },
  { icon: "⬡", title: "Yenkasa Verification", subtitle: "Secure your identity", to: "/verification" },
  { icon: "☰", title: "Communities", subtitle: "Join or create communities", to: "/communities" },
  { icon: "◌", title: "My Ads", subtitle: "Track your sponsored posts", to: "/ads" },
  { icon: "◫", title: "My Communities", subtitle: "Track communities you created", to: "/my-communities" },
  { icon: "◉", title: "Admin Economy", subtitle: "View YKC earnings and revenue", to: "/admin/economy", permission: "analytics" },
  { icon: "✓", title: "Post Approvals", subtitle: "Review pending posts", to: "/post-approvals", permission: "moderation" },
  { icon: "◎", title: "Approve Ads", subtitle: "Review sponsored ads", to: "/approve-ads", permission: "moderation" },
  { icon: "◈", title: "Approve Communities", subtitle: "Review community requests", to: "/approve-communities", permission: "moderation" },
  { icon: "◔", title: "Notifications", subtitle: "See your alerts", to: "/notifications" },
  { icon: "⚙", title: "Settings", subtitle: "Privacy and preferences", to: "/settings" },
];

export default function SideDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [user, setUser] = useState(storedUser);
  const permissions = getPermissions(user);
  const canSeeAnalytics = canAccessAnalytics(user);
  const canSeeModeration = canModerate(user);
  const visibleItems = menuItems.filter((item) => {
    if (item.permission === "analytics") return canSeeAnalytics;
    if (item.permission === "moderation") return canSeeModeration;
    return true;
  });

  console.debug("[YenkasaRBAC] SideDrawer", {
    currentRank: getUserRank(user),
    permissions,
    analyticsVisibility: canSeeAnalytics,
    sidebarRenderResult: visibleItems.map((item) => item.title),
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    getUserProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        const updated = updateStoredUser(profile);
        setUser(updated);
      })
      .catch(() => {
        setUser(getStoredUser() || {});
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

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
          <img
            src={staticImage("logo.png")}
            alt="Yenkasa"
            onError={(event) => handleStaticImageError(event, "logo.png")}
          />
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
