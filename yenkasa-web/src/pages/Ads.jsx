import { useMemo } from "react";
import { getAdsFeed, getMyAds } from "../api/ads";
import AdCard from "../components/AdCard";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";

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
