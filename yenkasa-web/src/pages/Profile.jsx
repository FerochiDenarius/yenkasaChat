import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { createChatRoom } from "../api/chatrooms";
import { followUser, getUserProfile, unfollowUser } from "../api/profile";
import BottomNav from "../components/feed/BottomNav";
import PostCard from "../components/feed/PostCard";
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
  const { userId: routeUserId } = useParams();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [profile, setProfile] = useState(null);
  const [followStats, setFollowStats] = useState(null);
  const [primaryCommunity, setPrimaryCommunity] = useState(null);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  const viewerId = String(storedUser?._id || storedUser?.id || "");
  const isOwnProfile = !routeUserId || String(routeUserId) === viewerId;

  useEffect(() => {
    let active = true;

    async function loadAccountInfo() {
      setLoading(true);
      setError("");

      try {
        const profileResponse = isOwnProfile
          ? await api.get("/profile")
          : { data: await getUserProfile(routeUserId) };
        if (!active) return;

        const currentProfile = profileResponse.data || {};
        setProfile(currentProfile);

        const userId = currentProfile?._id || routeUserId || storedUser?._id || storedUser?.id;
        const requests = [
          userId ? api.get(`/follow/${userId}/follow-stats`) : Promise.resolve({ data: null }),
          isOwnProfile
            ? api.get("/communities/user/community").catch(() => ({ data: { community: null } }))
            : Promise.resolve({ data: { community: null } }),
          isOwnProfile
            ? api.get("/communities/user/joined-communities").catch(() => ({ data: { communities: [] } }))
            : Promise.resolve({ data: { communities: [] } }),
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
        setPosts(Array.isArray(postsResponse?.data?.posts) ? postsResponse.data.posts : []);
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
  }, [isOwnProfile, routeUserId, storedUser]);

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
  const isFollowing = Boolean(
    followStats?.isFollowing ?? followStats?.isFollowedByViewer ?? user?.isFollowing
  );
  const coinBalance = Number(user?.coinsBalance ?? storedUser?.coinsBalance ?? 0);
  const username = user?.username || "Yenkasa";
  const handleTag = `@${String(username).trim().toLowerCase()}`;
  const joinedDate = formatJoinedDate(
    followStats?.createdAt || user?.createdAt || storedUser?.createdAt
  );
  const communitiesText = buildCommunitiesText(primaryCommunity, joinedCommunities);

  async function handleFollowToggle() {
    const targetId = user?._id || routeUserId;
    if (!targetId || followBusy || isOwnProfile) return;

    setFollowBusy(true);
    setError("");

    try {
      const response = isFollowing ? await unfollowUser(targetId) : await followUser(targetId);
      setFollowStats((current) => ({
        ...(current || {}),
        isFollowing: Boolean(response?.isFollowing),
        followersCount: Number(response?.followersCount ?? followersCount),
        followingCount,
      }));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Could not update follow status."
      );
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleMessageUser() {
    if (!username || chatBusy || isOwnProfile) return;

    setChatBusy(true);
    setError("");

    try {
      const response = await createChatRoom(username);
      if (response?.roomId) {
        navigate(`/chatrooms/${response.roomId}`);
        return;
      }
      setError(response?.message || "Message request sent.");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Could not open chat."
      );
    } finally {
      setChatBusy(false);
    }
  }

  function handlePostUpdate(postId, changes) {
    setPosts((current) =>
      current.map((post) => (post?._id === postId ? { ...post, ...changes } : post))
    );
  }

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
          <div className="account-topbar__title">{isOwnProfile ? "Account Info" : "Profile"}</div>
          {isOwnProfile ? (
            <button
              type="button"
              className="account-circle-btn"
              onClick={() => navigate("/settings")}
              aria-label="Open settings"
            >
              ⚙
            </button>
          ) : (
            <span className="account-circle-btn account-circle-btn--spacer" aria-hidden="true" />
          )}
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
              {isOwnProfile ? (
                <button
                  type="button"
                  className="account-hero__camera"
                  onClick={() => navigate("/edit-profile")}
                  aria-label="Change profile photo"
                >
                  📷
                </button>
              ) : null}
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

        {isOwnProfile ? (
          <button
            type="button"
            className="account-wallet-card"
            onClick={() => navigate("/wallet")}
          >
            <div className="account-wallet-card__icon">YKC</div>
            <div className="account-wallet-card__body">
              <span>YenkasaCoins</span>
              <strong>{formatCoins(coinBalance)}</strong>
            </div>
            <span className="account-wallet-card__cta">View Wallet ›</span>
          </button>
        ) : (
          <div className="account-profile-actions">
            <button
              type="button"
              className={`primary-btn${isFollowing ? " account-following-btn" : ""}`}
              onClick={handleFollowToggle}
              disabled={followBusy}
            >
              {followBusy ? "Working..." : isFollowing ? "Following" : "Follow"}
            </button>
            <button type="button" className="secondary-btn" onClick={handleMessageUser} disabled={chatBusy}>
              {chatBusy ? "Opening..." : "Message"}
            </button>
          </div>
        )}

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

        {isOwnProfile ? (
          <>
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
                onClick={() => navigate("/settings")}
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
          </>
        ) : null}

        <SectionLabel>Posts</SectionLabel>
        <section className="account-posts-list">
          {posts.length ? (
            posts.map((post) => (
              <PostCard key={post?._id} post={post} onUpdate={handlePostUpdate} />
            ))
          ) : (
            <div className="account-empty-posts">No public posts yet.</div>
          )}
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
