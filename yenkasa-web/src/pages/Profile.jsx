import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import BottomNav from "../components/feed/BottomNav";
import { clearAuth, getStoredUser } from "../utils/storage";
import { readableRank } from "../utils/format";
import {
  handleDynamicImageError,
  handleStaticImageError,
  staticImage,
} from "../utils/images";
import "../styles/account.css";

export default function Profile() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [profile, setProfile] = useState(null);
  const [followStats, setFollowStats] = useState(null);
  const [primaryCommunity, setPrimaryCommunity] = useState(null);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccountInfo() {
      setLoading(true);
      setError("");

      try {
        const profileResponse = await api.get("/profile");
        if (!active) return;

        const currentProfile = profileResponse.data || {};
        setProfile(currentProfile);

        const userId = currentProfile?._id || storedUser?._id || storedUser?.id;
        const requests = [
          userId ? api.get(`/follow/${userId}/follow-stats`) : Promise.resolve({ data: null }),
          api.get("/communities/user/community").catch(() => ({ data: { community: null } })),
          api.get("/communities/user/joined-communities").catch(() => ({ data: { communities: [] } })),
          userId ? api.get(`/posts/user/${userId}`) : Promise.resolve({ data: { posts: [] } }),
        ];

        const [followResponse, primaryResponse, joinedResponse, postsResponse] =
          await Promise.all(requests);

        if (!active) return;

        setFollowStats(followResponse?.data || null);
        setPrimaryCommunity(primaryResponse?.data?.community || null);
        setJoinedCommunities(
          Array.isArray(joinedResponse?.data?.communities)
            ? joinedResponse.data.communities
            : []
        );
        setPostCount(
          Array.isArray(postsResponse?.data?.posts)
            ? postsResponse.data.posts.length
            : 0
        );
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Account info could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccountInfo();

    return () => {
      active = false;
    };
  }, [storedUser]);

  const user = profile || storedUser || {};
  const roleName = user?.roleName || user?.role?.role || user?.role || "unverified";
  const profileImage =
    user?.profileImage ||
    user?.profilePicUrl ||
    user?.avatar ||
    staticImage("default.png");
  const followersCount =
    Number(followStats?.followersCount ?? user?.followersCount ?? user?.followers?.length ?? 0);
  const followingCount =
    Number(followStats?.followingCount ?? user?.followingCount ?? user?.following?.length ?? 0);
  const coinBalance = Number(user?.coinsBalance ?? storedUser?.coinsBalance ?? 0);
  const username = user?.username || "Yenkasa";
  const handleTag = `@${String(username).trim().toLowerCase()}`;
  const joinedDate = formatJoinedDate(
    followStats?.createdAt || user?.createdAt || storedUser?.createdAt
  );
  const communitiesText = buildCommunitiesText(primaryCommunity, joinedCommunities);

  return (
    <main className="account-page">
      <div className="account-page__shell">
        <header className="account-topbar">
          <button
            type="button"
            className="account-circle-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>
          <div className="account-topbar__title">Account Info</div>
          <button
            type="button"
            className="account-circle-btn"
            onClick={() => window.alert("Settings page is the next web screen to wire.")}
            aria-label="Open settings"
          >
            ⚙
          </button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="account-hero">
          <div className="account-hero__header">
            <div className="account-hero__avatar-wrap">
              <img
                className="account-hero__avatar"
                src={profileImage}
                alt={username}
                onError={handleDynamicImageError}
              />
              <button
                type="button"
                className="account-hero__camera"
                onClick={() => window.alert("Profile photo editing will be wired next.")}
                aria-label="Change profile photo"
              >
                📷
              </button>
            </div>

            <div className="account-hero__identity">
              <div className="account-hero__name-row">
                <h1>{username}</h1>
                {(user?.verified || roleName !== "unverified") && (
                  <img
                    className="account-hero__verified"
                    src={staticImage("verified.png")}
                    alt="Verified"
                    onError={(event) => handleStaticImageError(event, "verified.png")}
                  />
                )}
              </div>
              <p>{handleTag}</p>
            </div>
          </div>

          <div className="account-hero__stats">
            <Stat value={postCount} label="Posts" />
            <Stat value={followersCount} label="Followers" />
            <Stat value={followingCount} label="Following" />
          </div>
        </section>

        <button
          type="button"
          className="account-wallet-card"
          onClick={() => navigate("/wallet")}
        >
          <div className="account-wallet-card__icon">🪙</div>
          <div className="account-wallet-card__body">
            <span>YenkasaCoins</span>
            <strong>{formatCoins(coinBalance)}</strong>
          </div>
          <span className="account-wallet-card__cta">View Wallet ›</span>
        </button>

        <SectionLabel>About You</SectionLabel>
        <section className="account-surface">
          <InfoRow
            icon="🗓"
            title="Joined"
            value={joinedDate}
            onClick={() => {}}
          />
          <Divider />
          <InfoRow
            icon="💼"
            title="Role"
            value={readableRank(roleName)}
            onClick={() => navigate("/verification")}
          />
          <Divider />
          <InfoRow
            icon="👥"
            title="Communities"
            value={communitiesText}
            onClick={() => navigate("/communities")}
          />
        </section>

        <SectionLabel>Contact Information</SectionLabel>
        <section className="account-surface">
          <InfoRow
            icon="✉"
            title="Email"
            value={user?.email || "Not provided"}
            onClick={() => {}}
          />
          <Divider />
          <InfoRow
            icon="📞"
            title="Phone"
            value={user?.phone || user?.phoneNumber || "Not provided"}
            onClick={() => {}}
          />
        </section>

        <SectionLabel>Account</SectionLabel>
        <section className="account-surface">
          <InfoRow
            icon="🛡"
            title="Security"
            value="Password, 2FA, and security settings"
            onClick={() => window.alert("Security settings page is next to wire.")}
          />
          <Divider />
          <InfoRow
            icon="✎"
            title="Edit Profile"
            value="Update your profile information"
            onClick={() => navigate("/edit-profile")}
          />
          <Divider />
          <InfoRow
            icon="⇠"
            title="Log Out"
            value="Sign out of your account"
            danger
            onClick={() => {
              clearAuth();
              navigate("/login", { replace: true });
            }}
          />
        </section>

        {loading ? <div className="account-loading">Loading account info...</div> : null}
      </div>

      <BottomNav />
    </main>
  );
}

function Stat({ value, label }) {
  return (
    <div className="account-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="account-section-label">{children}</div>;
}

function Divider() {
  return <div className="account-divider" />;
}

function InfoRow({ icon, title, value, onClick, danger = false }) {
  return (
    <button
      type="button"
      className={`account-info-row${danger ? " account-info-row--danger" : ""}`}
      onClick={onClick}
    >
      <div className={`account-info-row__icon${danger ? " is-danger" : ""}`}>{icon}</div>
      <div className="account-info-row__body">
        <strong>{title}</strong>
        <span>{value}</span>
      </div>
      <div className="account-info-row__chevron">›</div>
    </button>
  );
}

function formatCoins(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatJoinedDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildCommunitiesText(primaryCommunity, joinedCommunities) {
  const ordered = [];
  const seen = new Set();

  [primaryCommunity, ...(joinedCommunities || [])].forEach((community) => {
    if (!community) return;
    const id = String(community._id || community.id || community.name || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(community);
  });

  if (!ordered.length) return "None";

  return ordered
    .map((community) => community.displayName || community.name || "Unknown")
    .join(", ");
}
