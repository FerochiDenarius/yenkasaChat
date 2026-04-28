import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import AdCard from "../AdCard";
import EmptyState from "../EmptyState";
import PostCard from "./PostCard";

export default function PostList({ activeTab, activeSort, selectedCommunity }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    loadFeed(selectedCommunity?._id || selectedCommunity?.id)
      .then((feedItems) => {
        if (mounted) setItems(feedItems);
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
    let adIndex = 0;
    filteredPosts.forEach((item, index) => {
      combined.push(item);
      if ((index + 1) % 4 === 0 && adsOnly[adIndex]) {
        combined.push(adsOnly[adIndex]);
        adIndex += 1;
      }
    });
    return combined;
  }, [activeSort, activeTab, items]);

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
        ) : (
          <PostCard
            key={item.key || item.post?._id || `post-${index}`}
            post={item.post}
            onUpdate={handleUpdate}
          />
        )
      )}
    </section>
  );
}

async function loadFeed(communityId) {
  const { data } = communityId
    ? await api.get(`/posts/community/${communityId}`)
    : await api.get("/feed");
  return normalizeFeedData(data);
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

function engagementScore(post) {
  return Number(post?.likeCount || 0) + Number(post?.commentCount || 0) + Number(post?.shareCount || 0);
}
