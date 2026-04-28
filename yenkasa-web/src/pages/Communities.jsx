import { useMemo } from "react";
import { getCommunities, getMyCommunities } from "../api/communities";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";

export default function Communities() {
  const publicState = useAsync(() => getCommunities(), true);
  const mineState = useAsync(getMyCommunities, true);

  const publicCommunities = useMemo(() => {
    const payload = publicState.data;
    return Array.isArray(payload) ? payload : [];
  }, [publicState.data]);

  const myCommunities = useMemo(() => {
    const payload = mineState.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.communities)) return payload.communities;
    return [];
  }, [mineState.data]);

  return (
    <main className="page page--with-nav">
      <PageHeader
        eyebrow="Network"
        title="Communities"
        subtitle="Discover public communities and track the ones you created."
      />

      <section className="stack">
        <h2 className="section-title">Public communities</h2>
        {publicCommunities.length ? (
          publicCommunities.map((community) => <CommunityCard key={community._id} community={community} />)
        ) : (
          <EmptyState title="No public communities" description="There are no public communities available right now." />
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

function CommunityCard({ community }) {
  return (
    <article className="card community-card">
      <div className="split-row">
        <div>
          <h3>{community?.name || "Community"}</h3>
          <p className="muted">{community?.description || "No description yet."}</p>
        </div>
        {community?.approvalStatus ? <span className="tag">{community.approvalStatus}</span> : null}
      </div>
      <div className="community-card__meta">
        <span>Members {community?.memberCount || 0}</span>
        {community?.country ? <span>{community.country}</span> : null}
      </div>
    </article>
  );
}
