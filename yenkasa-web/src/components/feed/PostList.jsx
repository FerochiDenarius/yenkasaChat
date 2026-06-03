import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import AdCard from "../AdCard";
import EmptyState from "../EmptyState";
import PostCard from "./PostCard";
import YenkasaFeedAd from "./YenkasaFeedAd";

const FEED_AD_INTERVAL = 4;
const PAGE_SIZE = 20;

export default function PostList({ activeTab, activeSort, selectedCommunity }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setPage(1);
    setHasMore(true);

    loadFeed(selectedCommunity?._id || selectedCommunity?.id, 1)
      .then((feedItems) => {
        if (!mounted) return;
        setItems(feedItems);
        setHasMore(countPosts(feedItems) >= PAGE_SIZE);
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load feed right now.");
          setItems([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedCommunity]);

  useEffect(() => {
    function handleScroll() {
      if (loading || loadingMore || !hasMore) return;
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining > window.innerHeight * 2) return;
      appendNextPage();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, loadingMore, page, selectedCommunity]);

  async function appendNextPage() {
    const nextPage = page + 1;
    setLoadingMore(true);
    console.debug("[YenkasaAdsWeb] normal feed page append", { nextPage });
    try {
      const nextItems = await loadFeed(selectedCommunity?._id || selectedCommunity?.id, nextPage);
      setItems((current) => mergeUniqueFeedItems(current, nextItems));
      setPage(nextPage);
      setHasMore(countPosts(nextItems) >= PAGE_SIZE);
    } catch (loadError) {
      console.warn("[YenkasaAdsWeb] normal feed page append failed", loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredItems = useMemo(() => {
    const normalized = items.filter(Boolean);
    const postsOnly = normalized.filter((item) => item.type === "post");
    const adsOnly = normalized.filter((item) => item.type === "ad");

    let filteredPosts = postsOnly;

    if (activeTab === "Following") {
      filteredPosts = postsOnly.filter((item) => item.post?.userId?.isFollowing === true || item.post?.isFollowing === true);
    } else if (activeTab === "Trending") {
      filteredPosts = [...postsOnly].sort((a, b) => engagementScore(b.post) - engagementScore(a.post));
    }

    if (activeSort === "Latest") {
      filteredPosts = [...filteredPosts].sort((a, b) => new Date(b.post?.createdAt || 0) - new Date(a.post?.createdAt || 0));
    } else if (activeSort === "Popular") {
      filteredPosts = [...filteredPosts].sort((a, b) => engagementScore(b.post) - engagementScore(a.post));
    } else if (activeSort === "Top") {
      filteredPosts = [...filteredPosts].sort((a, b) => Number(b.post?.likeCount || 0) - Number(a.post?.likeCount || 0));
    }

    const combined = [];
    filteredPosts.forEach((item, index) => {
      combined.push(item);
      if ((index + 1) % FEED_AD_INTERVAL === 0) {
        const adNumber = Math.floor((index + 1) / FEED_AD_INTERVAL);
        const useSponsoredAd = adsOnly.length && adNumber % 2 === 0;
        if (useSponsoredAd) {
          const adItem = adsOnly[(adNumber - 1) % adsOnly.length];
          combined.push({
            ...adItem,
            key: `${adItem.key || adItem.ad?._id || "ad"}-${index + 1}`
          });
        } else {
          const slotKey = `${activeTab}-${activeSort}-${selectedCommunity?._id || selectedCommunity?.id || "all"}-${index + 1}`;
          console.debug("[YenkasaAdsWeb] normal feed ad inserted", {
            organicIndex: index + 1,
            slotKey,
          });
          combined.push({
            key: `yenkasa-feed-ad-${slotKey}`,
            type: "yenkasa-feed-ad",
            slotKey,
          });
        }
      }
    });
    return combined;
  }, [activeSort, activeTab, items, selectedCommunity]);

  function handleUpdate(postId, patch) {
    setItems((prev) =>
      prev.map((item) =>
        item.type === "post" && item.post?._id === postId
          ? { ...item, post: { ...item.post, ...patch } }
          : item
      )
    );
  }

  if (loading) {
    return <div className="feed-status-card">Loading feed...</div>;
  }

  if (error) {
    return <div className="feed-error-card">{error}</div>;
  }

  if (!filteredItems.length) {
    return (
      <EmptyState
        title="No posts yet"
        description={
          selectedCommunity
            ? `No posts are available yet in ${
                selectedCommunity.displayName || selectedCommunity.name || "this community"
              }.`
            : "Your feed is empty for now. Join more communities or switch tabs."
        }
      />
    );
  }

  return (
    <section className="feed-post-list">
      {filteredItems.map((item, index) =>
        item.type === "ad" ? (
          <AdCard key={item.key || `ad-${index}`} ad={item.ad} compact />
        ) : item.type === "yenkasa-feed-ad" ? (
          <YenkasaFeedAd key={item.key || `yenkasa-ad-${index}`} slotKey={item.slotKey || item.key} />
        ) : (
          <PostCard
            key={item.key || item.post?._id || `post-${index}`}
            post={item.post}
            onUpdate={handleUpdate}
          />
        )
      )}
      {loadingMore ? <div className="feed-status-card">Loading more posts...</div> : null}
    </section>
  );
}

async function loadFeed(communityId, page = 1) {
  const params = { page, limit: PAGE_SIZE };
  const feedRequest = communityId
    ? await api.get(`/posts/community/${communityId}`, { params })
    : await api.get("/feed", { params });
  const sponsoredRequest = page === 1 ? api.get("/ads/feed").catch(() => null) : Promise.resolve(null);
  const sponsoredResponse = await sponsoredRequest;
  const feedItems = normalizeFeedData(feedRequest.data);
  const feedAdIds = new Set(feedItems.filter((item) => item.type === "ad").map((item) => item.ad?._id));
  const sponsoredAds = normalizeSponsoredAds(sponsoredResponse?.data).filter(
    (item) => !feedAdIds.has(item.ad?._id)
  );

  return [...feedItems, ...sponsoredAds];
}

function countPosts(feedItems) {
  return feedItems.filter((item) => item?.type === "post").length;
}

function mergeUniqueFeedItems(current, incoming) {
  const seenPostIds = new Set(
    current
      .filter((item) => item?.type === "post")
      .map((item) => item.post?._id)
      .filter(Boolean)
  );
  const seenAdIds = new Set(
    current
      .filter((item) => item?.type === "ad")
      .map((item) => item.ad?._id)
      .filter(Boolean)
  );

  const next = incoming.filter((item) => {
    if (item?.type === "post") {
      const id = item.post?._id;
      if (!id || seenPostIds.has(id)) return false;
      seenPostIds.add(id);
      return true;
    }
    if (item?.type === "ad") {
      const id = item.ad?._id;
      if (!id || seenAdIds.has(id)) return false;
      seenAdIds.add(id);
      return true;
    }
    return false;
  });

  return [...current, ...next];
}

function normalizeFeedData(data) {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.feed)
      ? data.feed
      : Array.isArray(data?.posts)
        ? data.posts
        : [];

  return rawItems.map((item, index) => {
    if (item?.__isAd && item?.ad) {
      return {
        key: item.ad._id || `ad-${index}`,
        type: "ad",
        ad: item.ad
      };
    }

    const post = item?.post || item;
    return {
      key: post?._id || `post-${index}`,
      type: "post",
      post
    };
  });
}

function normalizeSponsoredAds(data) {
  const ads = Array.isArray(data)
    ? data
    : Array.isArray(data?.ads)
      ? data.ads
      : Array.isArray(data?.feed)
        ? data.feed
        : [];

  return ads
    .filter(Boolean)
    .map((ad, index) => ({
      key: ad?._id || `sponsored-ad-${index}`,
      type: "ad",
      ad
    }));
}

function engagementScore(post) {
  return Number(post?.likeCount || 0) + Number(post?.commentCount || 0) + Number(post?.shareCount || 0);
}
