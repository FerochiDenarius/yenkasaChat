import { useMemo } from "react";
import { getAdsFeed, getMyAds } from "../api/ads";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";
import { buildMediaUrl, formatRelativeTime } from "../utils/format";

export default function Ads() {
  const feedState = useAsync(getAdsFeed, true);
  const mineState = useAsync(getMyAds, true);

  const ads = useMemo(() => {
    const feedData = feedState.data;
    if (Array.isArray(feedData)) return feedData;
    if (Array.isArray(feedData?.ads)) return feedData.ads;
    return [];
  }, [feedState.data]);

  const myAds = useMemo(() => {
    const mineData = mineState.data;
    if (Array.isArray(mineData)) return mineData;
    if (Array.isArray(mineData?.ads)) return mineData.ads;
    return [];
  }, [mineState.data]);

  return (
    <main className="page page--with-nav">
      <PageHeader
        eyebrow="Sponsored"
        title="Ads"
        subtitle="Browse approved sponsored ads and review your own submissions."
      />

      <section className="stack">
        <h2 className="section-title">Public ads feed</h2>
        {ads.length ? ads.map((ad) => <AdCard key={ad._id} ad={ad} />) : <EmptyState title="No ads yet" description="Approved ads will appear here." />}
      </section>

      <section className="stack">
        <h2 className="section-title">My ads</h2>
        {myAds.length ? myAds.map((ad) => <AdCard key={`mine-${ad._id}`} ad={ad} />) : <EmptyState title="No submitted ads" description="Your ad submissions will appear here." />}
      </section>
    </main>
  );
}

function AdCard({ ad }) {
  const mediaUrl = buildMediaUrl(ad);
  return (
    <article className="card ad-card">
      <div className="split-row">
        <div>
          <h3>{ad?.title || "Sponsored ad"}</h3>
          <p className="muted">{ad?.approvalStatus || "approved"} · {formatRelativeTime(ad?.createdAt)}</p>
        </div>
        {ad?.rewardAmount ? <span className="tag">{ad.rewardAmount} YKC</span> : null}
      </div>
      {mediaUrl ? (
        <div className="ad-card__media">
          <img src={mediaUrl} alt={ad?.title || "Ad preview"} />
        </div>
      ) : null}
      {ad?.ctaText ? <button className="secondary-btn">{ad.ctaText}</button> : null}
    </article>
  );
}
