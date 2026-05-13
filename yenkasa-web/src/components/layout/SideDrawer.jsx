import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile } from "../../api/profile";
import { useLocale } from "../../i18n/LocaleContext";
import { handleStaticImageError, staticImage } from "../../utils/images";
import { canAccessAnalytics, canModerate, getPermissions, getUserRank } from "../../utils/permissions";
import { clearAuth, getStoredUser, updateStoredUser } from "../../utils/storage";
import "../../styles/layout.css";

const menuItems = [
  { icon: "◉", titleKey: "contacts", subtitle: "Manage saved contacts", to: "/contacts" },
  { icon: "□", titleKey: "chatRooms", subtitle: "View all your chats", to: "/chatrooms" },
  { icon: "♙", titleKey: "accountInfo", subtitle: "Your account details", to: "/profile" },
  { icon: "▣", titleKey: "wallet", subtitle: "Your YKC balance", to: "/wallet" },
  { icon: "✎", titleKey: "editProfile", subtitle: "Update your profile", to: "/edit-profile" },
  { icon: "✓", titleKey: "verifyAccount", subtitle: "Verification options", to: "/verify-account" },
  { icon: "⬡", titleKey: "yenkasaVerification", subtitle: "Secure your identity", to: "/verification" },
  { icon: "☰", titleKey: "communities", subtitle: "Join or create communities", to: "/communities" },
  { icon: "◌", titleKey: "myAds", subtitle: "Track your sponsored posts", to: "/ads" },
  { icon: "◫", titleKey: "myCommunities", subtitle: "Track communities you created", to: "/my-communities" },
  { icon: "◉", titleKey: "adminEconomy", subtitle: "View YKC earnings and revenue", to: "/admin/economy", permission: "analytics" },
  { icon: "✓", titleKey: "postApprovals", subtitle: "Review pending posts", to: "/post-approvals", permission: "moderation" },
  { icon: "◎", titleKey: "approveAds", subtitle: "Review sponsored ads", to: "/approve-ads", permission: "moderation" },
  { icon: "◈", titleKey: "approveCommunities", subtitle: "Review community requests", to: "/approve-communities", permission: "moderation" },
  { icon: "◔", titleKey: "notifications", subtitle: "See your alerts", to: "/notifications" },
  { icon: "⚙", titleKey: "settings", subtitle: "Privacy and preferences", to: "/settings" },
];

export default function SideDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const { t } = useLocale();
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
    sidebarRenderResult: visibleItems.map((item) => item.titleKey),
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
            key={item.titleKey}
            onClick={() => goTo(item.to)}
          >
            <span className="side-drawer__item-icon">{item.icon}</span>
            <span className="side-drawer__item-copy">
              <strong>{t(item.titleKey)}</strong>
              <small>{item.subtitle}</small>
            </span>
          </button>
        ))}
      </nav>

      <button type="button" className="side-drawer__item side-drawer__item--logout" onClick={logout}>
        <span className="side-drawer__item-icon">⇠</span>
        <span className="side-drawer__item-copy">
          <strong>{t("logout")}</strong>
          <small>Sign out from Yenkasa</small>
        </span>
      </button>
    </aside>
  );
}
