import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MenuItem from "../components/menu/MenuItem";
import { handleStaticImageError, staticImage } from "../utils/images";
import { clearAuth, getStoredUser } from "../utils/storage";
import "../styles/menu.css";

export default function Menu() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser() || {}, []);

  const canReview = reviewerRoles.has(normalizeRole(user));

  function comingSoon(label) {
    window.alert(`${label} is not wired in the web app yet.`);
  }

  function logout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <main className="menu-page">
      <div className="menu-page__shell">
        <header className="menu-header">
          <img
            src={staticImage("logo.png")}
            alt="Yenkasa"
            className="menu-header__logo"
            onError={(event) => handleStaticImageError(event, "logo.png")}
          />
          <div>
            <h1>Yenkasa</h1>
            <p>Secure. Connect. Earn.</p>
          </div>
        </header>

        <section className="menu-card">
          <MenuItem icon="⌕" title="Contacts" subtitle="Manage saved contacts" onClick={() => comingSoon("Contacts")} />
          <MenuItem icon="◫" title="Chat Rooms" subtitle="View all your chats" onClick={() => comingSoon("Chat Rooms")} />
          <MenuItem icon="◎" title="Account Info" subtitle="Your account details" to="/profile" />
          <MenuItem icon="▣" title="Wallet" subtitle="Your YKC balance" to="/wallet" />
          <MenuItem icon="✎" title="Edit Profile" subtitle="Update your profile" to="/profile" />
          <MenuItem icon="⬡" title="Verify Account" subtitle="Verification options" onClick={() => comingSoon("Verify Account")} />
          <MenuItem icon="🛡" title="Yenkasa Verification" subtitle="Secure your identity" to="/verification" />
          <MenuItem icon="☰" title="Communities" subtitle="Join or create communities" to="/communities" />
          <MenuItem icon="◌" title="My Ads" subtitle="Track your ad submissions" to="/ads" />
          <MenuItem icon="◔" title="Notifications" subtitle="See your alerts" onClick={() => comingSoon("Notifications")} />
          <MenuItem icon="⚙" title="Settings" subtitle="Privacy & preferences" onClick={() => comingSoon("Settings")} />
          {canReview ? (
            <>
              <div className="menu-card__divider" />
              <MenuItem icon="✓" title="Post Approvals" subtitle="Review pending posts" onClick={() => comingSoon("Post Approvals")} />
              <MenuItem icon="◍" title="Approve Ads" subtitle="Review pending sponsored ads" onClick={() => comingSoon("Approve Ads")} />
              <MenuItem icon="◈" title="Approve Communities" subtitle="Review pending communities" onClick={() => comingSoon("Approve Communities")} />
            </>
          ) : null}
          <div className="menu-card__divider" />
          <MenuItem icon="⇠" title="Logout" subtitle="Sign out from Yenkasa" onClick={logout} accent="gold" danger />
        </section>
      </div>
    </main>
  );
}

const reviewerRoles = new Set([
  "admin",
  "moderator",
  "junior_developer",
  "senior_developer"
]);

function normalizeRole(user) {
  const raw = user?.roleName || user?.role?.role || user?.role || "";
  return String(raw).trim().toLowerCase();
}
