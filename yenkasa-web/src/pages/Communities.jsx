import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getCommunities,
  getJoinedCommunities,
  getMyCommunities,
  getPrimaryCommunity,
  joinCommunity,
  leaveCommunity,
} from "../api/communities";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";
import { requestWalletRefresh } from "../utils/walletEvents";
import "../styles/communities.css";

export default function Communities() {
  const [searchParams] = useSearchParams();
  const selectedCommunityId = searchParams.get("communityId");
  const selectedCommunityName = searchParams.get("community");
  const [busyCommunityId, setBusyCommunityId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loadGhanaCommunities = useCallback(() => getCommunities({ country: "Ghana" }), []);
  const publicState = useAsync(loadGhanaCommunities, true);
  const mineState = useAsync(getMyCommunities, true);
  const joinedState = useAsync(getJoinedCommunities, true);
  const primaryState = useAsync(getPrimaryCommunity, true);

  const publicCommunities = useMemo(() => {
    const payload = publicState.data;
    return Array.isArray(payload) ? payload : [];
  }, [publicState.data]);

  const visiblePublicCommunities = useMemo(() => {
    if (!selectedCommunityId && !selectedCommunityName) return publicCommunities;

    const normalizedName = String(selectedCommunityName || "").trim().toLowerCase();
    return publicCommunities.filter((community) => {
      const idMatch =
        selectedCommunityId &&
        String(community?._id || community?.id || "") === selectedCommunityId;
      const nameMatch =
        normalizedName &&
        String(community?.displayName || community?.name || "")
          .trim()
          .toLowerCase() === normalizedName;
      return idMatch || nameMatch;
    });
  }, [publicCommunities, selectedCommunityId, selectedCommunityName]);

  const myCommunities = useMemo(() => {
    const payload = mineState.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.communities)) return payload.communities;
    return [];
  }, [mineState.data]);

  const primaryCommunity = useMemo(
    () => primaryState.data?.community || null,
    [primaryState.data]
  );

  const joinedCommunities = useMemo(() => {
    const payload = joinedState.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.communities)) return payload.communities;
    return [];
  }, [joinedState.data]);

  const membershipIds = useMemo(() => {
    const ids = new Set();
    if (primaryCommunity?._id || primaryCommunity?.id) {
      ids.add(String(primaryCommunity._id || primaryCommunity.id));
    }
    joinedCommunities.forEach((community) => {
      const id = community?._id || community?.id;
      if (id) ids.add(String(id));
    });
    return ids;
  }, [joinedCommunities, primaryCommunity]);

  async function handleMembership(community, action) {
    const communityId = community?._id || community?.id;
    if (!communityId || busyCommunityId) return;

    setBusyCommunityId(String(communityId));
    setError("");
    setMessage("");

    try {
      const response =
        action === "leave"
          ? await leaveCommunity(communityId)
          : await joinCommunity(communityId);

      setMessage(response?.message || (action === "leave" ? "Left community." : "Joined community."));
      if (action === "join") requestWalletRefresh("join_community");
      await Promise.all([
        publicState.execute(),
        joinedState.execute(),
        primaryState.execute(),
      ]);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Could not update community membership."
      );
    } finally {
      setBusyCommunityId("");
    }
  }

  return (
    <main className="page page--with-nav">
      <PageHeader
        showBack
        eyebrow="Network"
        title="Communities"
        subtitle={
          selectedCommunityName
            ? `Viewing ${selectedCommunityName} in Ghana.`
            : "Discover Ghana communities and track the ones you created."
        }
      />

      <section className="communities-hero-card">
        <div>
          <span className="communities-hero-card__eyebrow">Ghana network</span>
          <h2>{selectedCommunityName ? selectedCommunityName : "Find your people"}</h2>
          <p>
            Join approved communities, leave groups you no longer need, and keep your feed focused.
          </p>
        </div>
        <div className="communities-hero-card__badge">
          <span>{publicCommunities.length}</span>
          <small>live communities</small>
        </div>
      </section>

      <section className="communities-panel">
        <div className="communities-section-head">
          <div>
            <span>Explore</span>
            <h2>
              {selectedCommunityName
                ? `${selectedCommunityName} in Ghana`
                : "Public communities in Ghana"}
            </h2>
          </div>
        </div>
        {message ? <div className="success-banner">{message}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
        {publicState.loading ? (
          <div className="feed-status-card">Loading Ghana communities...</div>
        ) : visiblePublicCommunities.length ? (
          <div className="communities-grid">
            {visiblePublicCommunities.map((community) => (
              <CommunityCard
                key={community._id || community.id}
                community={community}
                isMember={membershipIds.has(String(community?._id || community?.id || ""))}
                isPrimary={
                  String(primaryCommunity?._id || primaryCommunity?.id || "") ===
                  String(community?._id || community?.id || "")
                }
                busy={busyCommunityId === String(community?._id || community?.id || "")}
                onMembership={handleMembership}
                selected={
                  String(community?._id || community?.id || "") === selectedCommunityId ||
                  String(community?.displayName || community?.name || "")
                    .trim()
                    .toLowerCase() === String(selectedCommunityName || "").trim().toLowerCase()
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No public communities"
            description={
              selectedCommunityName
                ? `No approved Ghana community matched ${selectedCommunityName}.`
                : "There are no approved Ghana communities available right now."
            }
          />
        )}
      </section>

      <section className="communities-panel">
        <div className="communities-section-head">
          <div>
            <span>Your feed</span>
            <h2>Joined communities</h2>
          </div>
        </div>
        {joinedCommunities.length ? (
          <div className="communities-grid">
            {joinedCommunities.map((community) => (
              <CommunityCard
                key={`joined-${community._id || community.id}`}
                community={community}
                isMember
                isPrimary={community?.isRegistration}
                busy={busyCommunityId === String(community?._id || community?.id || "")}
                onMembership={handleMembership}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No joined communities" description="Communities you join will appear here." />
        )}
      </section>

      <section className="communities-panel">
        <div className="communities-section-head">
          <div>
            <span>Created by you</span>
            <h2>My created communities</h2>
          </div>
        </div>
        {myCommunities.length ? (
          <div className="communities-grid">
            {myCommunities.map((community) => (
              <CommunityCard
                key={`mine-${community._id || community.id}`}
                community={community}
                isMember={membershipIds.has(String(community?._id || community?.id || ""))}
                isPrimary={
                  String(primaryCommunity?._id || primaryCommunity?.id || "") ===
                  String(community?._id || community?.id || "")
                }
                busy={busyCommunityId === String(community?._id || community?.id || "")}
                onMembership={handleMembership}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No created communities" description="Communities you create will appear here." />
        )}
      </section>
    </main>
  );
}

function CommunityCard({
  community,
  selected = false,
  isMember = false,
  isPrimary = false,
  busy = false,
  onMembership,
}) {
  const displayName = community?.displayName || community?.name || "Community";
  const status = normalizedStatus(community);
  const communityId = community?._id || community?.id;
  const memberCount = Number(community?.memberCount || 0);
  const canJoin = status === "approved" && !isMember;
  const canLeave = isMember && !isPrimary;

  return (
    <article className={`community-card${selected ? " community-card--selected" : ""}`}>
      <div className="community-card__top">
        <div className="community-card__avatar">
          {community?.icon ? <img src={community.icon} alt="" /> : <span>{initials(displayName)}</span>}
        </div>
        <div className="community-card__title">
          <h3>{displayName}</h3>
          <p>{community?.description || "No description yet."}</p>
        </div>
        <span className={`community-status community-status--${isPrimary ? "primary" : isMember ? "joined" : status}`}>
          {isPrimary ? "primary" : isMember ? "joined" : status}
        </span>
      </div>
      <div className="community-card__meta">
        <span>{formatMembers(memberCount)} members</span>
        <span>{community?.isPrivate ? "Private" : "Public"}</span>
        {community?.country ? <span>{community.country}</span> : null}
      </div>
      {community?.creator?.username ? <p className="community-card__creator">Creator: {community.creator.username}</p> : null}
      <div className="community-card__actions">
        {canJoin ? (
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !communityId}
            onClick={() => onMembership?.(community, "join")}
          >
            {busy ? "Joining..." : "Join"}
          </button>
        ) : null}
        {canLeave ? (
          <button
            type="button"
            className="secondary-btn"
            disabled={busy || !communityId}
            onClick={() => onMembership?.(community, "leave")}
          >
            {busy ? "Leaving..." : "Leave"}
          </button>
        ) : null}
        {isPrimary ? <span className="muted">Primary signup community</span> : null}
        {!canJoin && !canLeave && !isPrimary && status !== "approved" ? (
          <span className="muted">Not available to join yet</span>
        ) : null}
      </div>
    </article>
  );
}

function normalizedStatus(community) {
  if (community?.isActive === false) return "rejected";
  if (community?.isApproved !== false) return "approved";
  return "pending";
}

function initials(value) {
  return String(value || "Y")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatMembers(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}
