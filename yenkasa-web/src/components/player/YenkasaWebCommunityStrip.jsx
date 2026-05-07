import { memo, useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { handleDynamicImageError, staticImage } from "../../utils/images";

const fallbackCommunities = [
  { _id: "afrobeats", name: "Afrobeats", memberCount: 23100 },
  { _id: "music", name: "Music Lovers", memberCount: 18700 },
  { _id: "business", name: "Entrepreneurs", memberCount: 12400 },
  { _id: "creative", name: "Creative Minds", memberCount: 9800 },
  { _id: "books", name: "Book Club", memberCount: 15600 },
];

function YenkasaWebCommunityStrip({ selectedCommunityId, onSelectCommunity }) {
  const [communities, setCommunities] = useState([]);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .get("/communities/public", { params: { country: "Ghana" } })
      .then(({ data }) => {
        if (mounted) setCommunities(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setCommunities([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => (communities.length ? communities : fallbackCommunities), [communities]);
  const communityItems = useMemo(
    () => [{ _id: null, id: null, name: "All", memberCount: 0, isAll: true }, ...items],
    [items]
  );
  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return communityItems;
    return communityItems.filter((community) =>
      String(community.displayName || community.name || "")
        .toLowerCase()
        .includes(cleanQuery)
    );
  }, [communityItems, query]);
  const trendingItems = useMemo(
    () =>
      [...items]
        .sort((a, b) => Number(b.memberCount || b.membersCount || 0) - Number(a.memberCount || a.membersCount || 0))
        .slice(0, 8),
    [items]
  );
  const joinedItems = useMemo(() => items.filter((community) => community.isJoined || community.joined).slice(0, 8), [items]);

  function selectCommunity(community) {
    setBrowserOpen(false);
    onSelectCommunity?.(community?.isAll ? null : community);
  }

  return (
    <section className="player-community-strip player-community-strip--top" aria-label="Communities">
      <header className="player-community-strip__header">
        <strong>Communities</strong>
      </header>
      <div className="player-community-strip__list" aria-label="Community list">
        {communityItems.slice(0, 12).map((community, index) => {
          const id = community._id || community.id || `all-${index}`;
          const selected = community.isAll ? !selectedCommunityId : String(id) === String(selectedCommunityId || "");
          return <CommunityCard community={community} key={id} selected={selected} onClick={() => selectCommunity(community)} />;
        })}
        <button type="button" className="player-community-next" onClick={() => setBrowserOpen(true)} aria-label="Browse communities">
          ›
        </button>
      </div>
      {browserOpen ? (
        <CommunityBrowser
          communities={filteredItems}
          joinedItems={joinedItems}
          onClose={() => setBrowserOpen(false)}
          onSelect={selectCommunity}
          query={query}
          selectedCommunityId={selectedCommunityId}
          setQuery={setQuery}
          trendingItems={trendingItems}
        />
      ) : null}
    </section>
  );
}

function CommunityCard({ community, selected, onClick }) {
  const name = community.displayName || community.name || "Yenkasa";
  const image = community.coverImage || community.icon || community.image;
  return (
    <button
      type="button"
      className={`player-community-card${community.isAll ? " player-community-card--all" : ""}${selected ? " is-selected" : ""}`}
      onClick={onClick}
    >
      {image ? (
        <img src={image} alt="" loading="lazy" onError={handleDynamicImageError} />
      ) : (
        <span className="player-community-card__fallback">{community.isAll ? "🌐" : initials(name)}</span>
      )}
      {selected ? <span className="player-community-card__check">✓</span> : null}
      <strong>{name}</strong>
      <small><i />Live</small>
    </button>
  );
}

function CommunityBrowser({
  communities,
  joinedItems,
  onClose,
  onSelect,
  query,
  selectedCommunityId,
  setQuery,
  trendingItems,
}) {
  return (
    <div className="player-community-browser" role="dialog" aria-modal="true" aria-label="Browse communities">
      <button type="button" className="player-community-browser__backdrop" onClick={onClose} aria-label="Close communities" />
      <div className="player-community-browser__sheet">
        <header className="player-community-browser__header">
          <div>
            <strong>Communities</strong>
            <small>Find your next room</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close communities">×</button>
        </header>
        <label className="player-community-browser__search">
          <span>⌕</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search communities" />
        </label>
        <div className="player-community-browser__chips" aria-label="Community categories">
          {["All", "Music", "Sports", "News", "Campus", "Business"].map((category) => (
            <span key={category}>{category}</span>
          ))}
        </div>
        {joinedItems.length ? (
          <CommunityBrowserSection title="Joined" communities={joinedItems} selectedCommunityId={selectedCommunityId} onSelect={onSelect} />
        ) : null}
        <CommunityBrowserSection title="Trending" communities={trendingItems} selectedCommunityId={selectedCommunityId} onSelect={onSelect} />
        <CommunityBrowserSection
          title={query ? "Search Results" : "Suggested"}
          communities={communities}
          selectedCommunityId={selectedCommunityId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function CommunityBrowserSection({ communities, onSelect, selectedCommunityId, title }) {
  if (!communities.length) return null;
  return (
    <section className="player-community-browser__section">
      <h3>{title}</h3>
      <div className="player-community-browser__grid">
        {communities.map((community, index) => {
          const id = community._id || community.id || `all-${index}`;
          const selected = community.isAll ? !selectedCommunityId : String(id) === String(selectedCommunityId || "");
          return <CommunityCard community={community} key={`${title}-${id}`} selected={selected} onClick={() => onSelect(community)} />;
        })}
      </div>
    </section>
  );
}

function initials(value = "") {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default memo(YenkasaWebCommunityStrip);
