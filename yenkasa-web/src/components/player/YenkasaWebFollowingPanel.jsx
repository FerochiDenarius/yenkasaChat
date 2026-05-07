import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime, getPostCommentCount } from "../../utils/format";
import { handleStaticImageError, staticImage } from "../../utils/images";

const PANEL_CATEGORIES = ["Following", "For You", "Trending", "Latest", "Popular"];

function YenkasaWebFollowingPanel({ activeCategory = "For You", onSelectCategory, posts = [] }) {
  const navigate = useNavigate();
  const people = useMemo(() => buildCategoryItems(posts, activeCategory), [activeCategory, posts]);

  if (!people.length) return null;

  return (
    <aside className="player-following-panel" aria-label="Feed categories">
      <header>
        <strong>{activeCategory}</strong>
        <span>⌄</span>
      </header>
      <nav className="player-following-panel__tabs" aria-label="Feed category tabs">
        {PANEL_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category}
            className={category === activeCategory ? "is-active" : ""}
            onClick={() => onSelectCategory?.(category)}
          >
            {category}
          </button>
        ))}
      </nav>
      <div className="player-following-panel__list">
        {people.map((person) => (
          <button
            type="button"
            className="player-following-user"
            key={person.key}
            onClick={() => person.id && navigate(`/profile/${person.id}`)}
          >
            <img src={person.avatar || staticImage("default.png")} alt="" loading="lazy" onError={(event) => handleStaticImageError(event, "default.png")} />
            <span>
              <strong>@{person.username}</strong>
              <small><i />{person.meta}</small>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="player-following-panel__view-all" onClick={() => navigate(activeCategory === "Following" ? "/contacts" : "/explore")}>
        View All <span>›</span>
      </button>
    </aside>
  );
}

function buildCategoryItems(posts, category) {
  const items = uniquePostAuthors(posts);

  if (category === "Following") {
    const followed = items.filter((item) => item.followed);
    return (followed.length ? followed : items).slice(0, 5).map((item) => ({
      ...item,
      meta: item.createdAt ? formatRelativeTime(item.createdAt).replace(/^about /, "") : "Now",
    }));
  }

  if (category === "Latest") {
    return [...items]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
      .map((item) => ({ ...item, meta: item.createdAt ? formatRelativeTime(item.createdAt).replace(/^about /, "") : "Now" }));
  }

  if (category === "Trending") {
    return [...items]
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 5)
      .map((item) => ({ ...item, meta: `${formatCompact(item.engagement)} engaged` }));
  }

  if (category === "Popular") {
    return [...items]
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5)
      .map((item) => ({ ...item, meta: `${formatCompact(item.engagement)} total` }));
  }

  return [...items]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5)
    .map((item) => ({ ...item, meta: item.community || "Suggested" }));
}

function uniquePostAuthors(posts) {
  const map = new Map();

  posts.forEach((post, index) => {
    const author = post?.userId || post?.author || {};
    const id = author?._id || author?.id || post?.authorId || post?.username || `author-${index}`;
    const key = String(id);
    const existing = map.get(key);
    const engagement = activityScore(post);
    const createdAt = post?.createdAt;
    const next = {
      avatar: author?.profileImage || author?.profileImageUrl || author?.avatar,
      community: post?.communityId?.displayName || post?.communityId?.name || post?.communityName,
      createdAt,
      engagement: Number(existing?.engagement || 0) + engagement,
      followed: Boolean(existing?.followed || author?.isFollowing || post?.isFollowing || post?.communityId?.isJoined),
      id,
      key,
      relevance: Number(existing?.relevance || 0) + engagement + Math.max(0, 100 - index),
      trendingScore: Number(existing?.trendingScore || 0) + trendingScore(post),
      username: author?.username || post?.username || "yenkasa",
    };

    if (existing?.createdAt && createdAt && new Date(existing.createdAt) > new Date(createdAt)) {
      next.createdAt = existing.createdAt;
    }

    map.set(key, next);
  });

  return [...map.values()];
}

function activityScore(post) {
  return (
    Number(post?.likeCount || 0) +
    Number(getPostCommentCount(post) || 0) * 2 +
    Number(post?.shareCount || 0) * 3 +
    Number(post?.viewCount || post?.viewsCount || 0) * 0.2
  );
}

function trendingScore(post) {
  const ageHours = Math.max(1, (Date.now() - new Date(post?.createdAt || 0).getTime()) / 3600000);
  return activityScore(post) / Math.pow(ageHours, 0.75);
}

function formatCompact(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(Math.round(number));
}

export default memo(YenkasaWebFollowingPanel);
