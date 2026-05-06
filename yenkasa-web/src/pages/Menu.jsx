import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile } from "../api/profile";
import MenuItem from "../components/menu/MenuItem";
import { handleStaticImageError, staticImage } from "../utils/images";
import { canAccessAdminFeatures } from "../utils/roles";
import { clearAuth, getStoredUser, updateStoredUser } from "../utils/storage";
import "../styles/menu.css";

export default function Menu() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [user, setUser] = useState(storedUser);

  const canAccessAdmin = canAccessAdminFeatures(user);

  useEffect(() => {
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
  }, []);

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
          <MenuItem icon="⌕" title="Contacts" subtitle="Manage saved contacts" to="/contacts" />
          <MenuItem icon="◫" title="Chat Rooms" subtitle="View all your chats" to="/chatrooms" />
          <MenuItem icon="◎" title="Account Info" subtitle="Your account details" to="/profile" />
          <MenuItem icon="▣" title="Wallet" subtitle="Your YKC balance" to="/wallet" />
          <MenuItem icon="✎" title="Edit Profile" subtitle="Update your profile" to="/edit-profile" />
          <MenuItem icon="⬡" title="Verify Account" subtitle="Verification options" to="/verify-account" />
          <MenuItem icon="🛡" title="Yenkasa Verification" subtitle="Secure your identity" to="/verification" />
          <MenuItem icon="☰" title="Communities" subtitle="Join or create communities" to="/communities" />
          <MenuItem icon="◌" title="My Ads" subtitle="Track your ad submissions" to="/ads" />
          <MenuItem icon="◔" title="Notifications" subtitle="See your alerts" to="/notifications" />
          <MenuItem icon="⚙" title="Settings" subtitle="Privacy & preferences" to="/settings" />
          {canAccessAdmin ? (
            <>
              <div className="menu-card__divider" />
              <MenuItem icon="◉" title="Admin Economy" subtitle="View YKC earnings and revenue" to="/admin/economy" />
              <MenuItem icon="✓" title="Post Approvals" subtitle="Review pending posts" to="/post-approvals" />
              <MenuItem icon="◍" title="Approve Ads" subtitle="Review pending sponsored ads" to="/approve-ads" />
              <MenuItem icon="◈" title="Approve Communities" subtitle="Review pending communities" to="/approve-communities" />
            </>
          ) : null}
          <div className="menu-card__divider" />
          <MenuItem icon="⇠" title="Logout" subtitle="Sign out from Yenkasa" onClick={logout} accent="gold" danger />
        </section>
      </div>
    </main>
  );
}
