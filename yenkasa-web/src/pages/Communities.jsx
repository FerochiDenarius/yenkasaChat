import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { getCommunities, getMyCommunities } from "../api/communities";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";

export default function Communities() {
  const [searchParams] = useSearchParams();
  const selectedCommunityId = searchParams.get("communityId");
  const selectedCommunityName = searchParams.get("community");
  const publicState = useAsync(() => getCommunities({ country: "Ghana" }), true);
  const mineState = useAsync(getMyCommunities, true);

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
        {visiblePublicCommunities.length ? (
          visiblePublicCommunities.map((community) => (
            <CommunityCard
              key={community._id}
              community={community}
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
        <h2 className="section-title">My communities</h2>
        {myCommunities.length ? (
          myCommunities.map((community) => <CommunityCard key={`mine-${community._id}`} community={community} />)
        ) : (
          <EmptyState title="No created communities" description="Communities you create will appear here." />
        )}
      </section>
    </main>
  );
}

function CommunityCard({ community, selected = false }) {
  const displayName = community?.displayName || community?.name || "Community";
  const status = normalizedStatus(community);

  return (
    <article className={`card community-card${selected ? " community-card--selected" : ""}`}>
      <div className="split-row">
        <div>
          <h3>{displayName}</h3>
          <p className="muted">{community?.description || "No description yet."}</p>
        </div>
        <span className="tag">{status}</span>
      </div>
      <div className="community-card__meta">
        <span>Members {community?.memberCount || 0}</span>
        {community?.country ? <span>{community.country}</span> : null}
      </div>
      {community?.creator?.username ? <p className="muted">Creator: {community.creator.username}</p> : null}
    </article>
  );
}

function normalizedStatus(community) {
  if (!community?.isActive) return "rejected";
  if (community?.isApproved) return "approved";
  return "pending";
}
