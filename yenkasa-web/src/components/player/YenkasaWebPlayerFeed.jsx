import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/client";
import BottomNav from "../feed/BottomNav";
import FloatingButton from "../feed/FloatingButton";
import YenkasaLiveSheet from "../feed/YenkasaLiveSheet";
import { handleStaticImageError, staticImage } from "../../utils/images";
import YenkasaAdSenseSlot from "./YenkasaAdSenseSlot";
import YenkasaWebCommunityStrip from "./YenkasaWebCommunityStrip";
import YenkasaWebLiveArenaButton from "./YenkasaWebLiveArenaButton";
import YenkasaWebPlayerCard from "./YenkasaWebPlayerCard";
import YenkasaWebWalletPill from "./YenkasaWebWalletPill";
import "../../styles/player-feed.css";

const tabs = ["Following", "For You", "Trending", "Top", "Latest", "Popular"];
const AD_INTERVAL = 5;

export default function YenkasaWebPlayerFeed({ onOpenMenu }) {
  const feedRef = useRef(null);
  const [activeTab, setActiveTab] = useState("For You");
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLive, setShowLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    loadPosts({
      communityId: selectedCommunity?._id || selectedCommunity?.id,
      tab: activeTab,
    })
      .then((nextPosts) => {
        if (!mounted) return;
        setPosts(nextPosts);
        setActiveIndex(0);
        feedRef.current?.scrollTo({ top: 0, behavior: "instant" });
      })
      .catch(() => {
        if (!mounted) return;
        setPosts([]);
        setError("Could not load the feed right now.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, selectedCommunity]);

  const rankedPosts = useMemo(
    () => rankPosts(posts, activeTab),
    [activeTab, posts]
  );

  const feedItems = useMemo(() => {
    const items = [];
    rankedPosts.forEach((post, index) => {
      items.push({ type: "post", key: post?._id || `post-${index}`, post });
      if ((index + 1) % AD_INTERVAL === 0) {
        items.push({ type: "adsense", key: `adsense-${index + 1}` });
      }
    });
    return items;
  }, [rankedPosts]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number(visible.target.getAttribute("data-feed-index") || 0);
        setActiveIndex(index);
      },
      { root, threshold: [0.55, 0.75] }
    );

    root.querySelectorAll("[data-feed-index]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [feedItems.length]);

  function handleUpdate(postId, patch) {
    setPosts((current) =>
      current.map((post) =>
        post?._id === postId ? { ...post, ...patch } : post
      )
    );
  }

  return (
    <main className="player-feed-page">
      <header className="player-topbar">
        <div className="player-brand">
          <img
            src={staticImage("logo.png")}
            alt="Yenkasa"
            onError={(event) => handleStaticImageError(event, "logo.png")}
          />
          <strong>YENKASA</strong>
        </div>
        <YenkasaWebWalletPill />
        <button type="button" className="player-menu-button" onClick={onOpenMenu} aria-label="Open menu">
          ☰
        </button>
      </header>

      <YenkasaWebCommunityStrip
        selectedCommunityId={selectedCommunity?._id || selectedCommunity?.id || null}
        onSelectCommunity={setSelectedCommunity}
      />

      <nav className="player-tabs" aria-label="Feed tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <YenkasaWebLiveArenaButton onClick={() => setShowLive(true)} />

      <section ref={feedRef} className="player-feed-scroll" aria-label="Yenkasa PlayerView Feed">
        {loading ? <PlayerState title="Loading feed..." /> : null}
        {!loading && error ? <PlayerState title={error} /> : null}
        {!loading && !error && !feedItems.length ? (
          <PlayerState title="No posts yet" subtitle="Try another tab or community." />
        ) : null}
        {!loading && !error
          ? feedItems.map((item, index) => (
              <div className="player-snap-item" data-feed-index={index} key={item.key}>
                {item.type === "adsense" ? (
                  <YenkasaAdSenseSlot slotKey={item.key} />
                ) : (
                  <YenkasaWebPlayerCard
                    post={item.post}
                    active={index === activeIndex}
                    onUpdate={handleUpdate}
                  />
                )}
              </div>
            ))
          : null}
      </section>

      <YenkasaLiveSheet
        open={showLive}
        onClose={() => setShowLive(false)}
        onQuickAction={() => setShowLive(false)}
      />
      <FloatingButton />
      <BottomNav />
    </main>
  );
}

function PlayerState({ title, subtitle }) {
  return (
    <div className="player-snap-item">
      <article className="player-state">
        <div className="player-state__spinner" />
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </article>
    </div>
  );
}

async function loadPosts({ communityId, tab }) {
  const feedType = tabToFeedType(tab);
  const params = { page: 1, limit: 30, feedType };
  const response = communityId
    ? await api.get(`/posts/community/${communityId}`, { params })
    : await api.get("/feed", { params });
  return normalizePosts(response.data);
}

function tabToFeedType(tab) {
  return String(tab || "for-you").trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizePosts(data) {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.feed)
      ? data.feed
      : Array.isArray(data?.posts)
        ? data.posts
        : [];

  return raw
    .filter((item) => !item?.__isAd)
    .map((item) => item?.post || item)
    .filter(Boolean);
}

function rankPosts(posts, tab) {
  const items = [...posts];

  if (tab === "Latest") {
    return items.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  }

  if (tab === "Popular") {
    return items.sort((a, b) => activityScore(b) - activityScore(a));
  }

  if (tab === "Trending") {
    return items.sort((a, b) => trendingScore(b) - trendingScore(a));
  }

  if (tab === "Following") {
    const followed = items.filter(
      (post) => post?.userId?.isFollowing === true || post?.isFollowing === true || post?.communityId?.isJoined === true
    );
    return followed.length ? followed : items.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  }

  if (tab === "Top") {
    return items.sort((a, b) => activityScore(b) - activityScore(a));
  }

  return items.sort((a, b) => trendingScore(b) - trendingScore(a));
}

function activityScore(post) {
  return (
    Number(post?.likeCount || 0) +
    Number(post?.commentCount || 0) * 2 +
    Number(post?.shareCount || 0) * 3 +
    Number(post?.viewCount || post?.viewsCount || 0) * 0.2
  );
}

function trendingScore(post) {
  const ageHours = Math.max(1, (Date.now() - new Date(post?.createdAt || 0).getTime()) / 3600000);
  return activityScore(post) / Math.pow(ageHours, 0.75);
}
