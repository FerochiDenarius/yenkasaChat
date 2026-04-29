import { useMemo, useState } from "react";
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

export default function Communities() {
  const [searchParams] = useSearchParams();
  const selectedCommunityId = searchParams.get("communityId");
  const selectedCommunityName = searchParams.get("community");
  const [busyCommunityId, setBusyCommunityId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const publicState = useAsync(() => getCommunities({ country: "Ghana" }), true);
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
        publicState.run(),
        joinedState.run(),
        primaryState.run(),
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

      <section className="stack">
        <h2 className="section-title">
          {selectedCommunityName
            ? `${selectedCommunityName} in Ghana`
            : "Public communities in Ghana"}
        </h2>
        {message ? <div className="success-banner">{message}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
        {visiblePublicCommunities.length ? (
          visiblePublicCommunities.map((community) => (
            <CommunityCard
              key={community._id}
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
          ))
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

      <section className="stack">
        <h2 className="section-title">Joined communities</h2>
        {joinedCommunities.length ? (
          joinedCommunities.map((community) => (
            <CommunityCard
              key={`joined-${community._id || community.id}`}
              community={community}
              isMember
              isPrimary={community?.isRegistration}
              busy={busyCommunityId === String(community?._id || community?.id || "")}
              onMembership={handleMembership}
            />
          ))
        ) : (
          <EmptyState title="No joined communities" description="Communities you join will appear here." />
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">My created communities</h2>
        {myCommunities.length ? (
          myCommunities.map((community) => (
            <CommunityCard
              key={`mine-${community._id}`}
              community={community}
              isMember={membershipIds.has(String(community?._id || community?.id || ""))}
              isPrimary={
                String(primaryCommunity?._id || primaryCommunity?.id || "") ===
                String(community?._id || community?.id || "")
              }
              busy={busyCommunityId === String(community?._id || community?.id || "")}
              onMembership={handleMembership}
            />
          ))
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
  const canJoin = status === "approved" && !isMember;
  const canLeave = isMember && !isPrimary;

  return (
    <article className={`card community-card${selected ? " community-card--selected" : ""}`}>
      <div className="split-row">
        <div>
          <h3>{displayName}</h3>
          <p className="muted">{community?.description || "No description yet."}</p>
        </div>
        <span className="tag">{isPrimary ? "primary" : isMember ? "joined" : status}</span>
      </div>
      <div className="community-card__meta">
        <span>Members {community?.memberCount || 0}</span>
        {community?.country ? <span>{community.country}</span> : null}
      </div>
      {community?.creator?.username ? <p className="muted">Creator: {community.creator.username}</p> : null}
      <div className="community-card__actions">
        {canJoin ? (
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !communityId}
            onClick={() => onMembership?.(community, "join")}
          >
            {busy ? "Joining..." : "Join community"}
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
  if (!community?.isActive) return "rejected";
  if (community?.isApproved) return "approved";
  return "pending";
}
