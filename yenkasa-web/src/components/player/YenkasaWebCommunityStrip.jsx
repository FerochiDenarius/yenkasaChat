import { memo, useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { handleDynamicImageError, staticImage } from "../../utils/images";

const fallbackCommunities = [
  { _id: "afrobeats", name: "Afrobeats", memberCount: 23100 },
  { _id: "chill", name: "Chill Vibes", memberCount: 18700 },
  { _id: "gospel", name: "Gospel", memberCount: 12400 },
  { _id: "street", name: "Street Talk", memberCount: 9800 },
  { _id: "tv", name: "Yenkasa TV", memberCount: 15600, icon: staticImage("logo.png") },
];

function YenkasaWebCommunityStrip({ selectedCommunityId, onSelectCommunity }) {
  const [communities, setCommunities] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get("/communities/public", { params: { country: "Ghana" } })
      .then(({ data }) => {
        if (!mounted) return;
        setCommunities(Array.isArray(data) ? data : []);
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
    () => [
      { _id: null, id: null, name: "All", memberCount: 0, isAll: true },
      ...items.slice(0, 8),
    ],
    [items]
  );
  const selectedItem =
    communityItems.find((community) => String(community._id || community.id || "") === String(selectedCommunityId || "")) ||
    communityItems[0];
  const previewItems = communityItems
    .filter((community) => (community._id || community.id || "all") !== (selectedItem?._id || selectedItem?.id || "all"))
    .slice(0, 3);

  function selectCommunity(community) {
    setExpanded(false);
    onSelectCommunity?.(community?.isAll ? null : community);
  }

  return (
    <section
      className={`player-community-strip${expanded ? " is-expanded" : " is-compact"}`}
      aria-label="Communities"
    >
      <div className="player-community-strip__header">
        <strong>Communities</strong>
        <button type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Close" : "See all"} <span>›</span>
        </button>
      </div>
      {expanded ? (
        <div className="player-community-strip__list">
          {communityItems.map((community, index) => {
            const id = community._id || community.id || `all-${index}`;
            const selected = community.isAll ? !selectedCommunityId : String(id) === String(selectedCommunityId || "");
            return (
              <CommunityCard
                community={community}
                key={id}
                selected={selected}
                onClick={() => selectCommunity(community)}
              />
            );
          })}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="player-community-stack"
          onClick={() => setExpanded(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setExpanded(true);
          }}
          aria-label="Expand communities"
        >
          {previewItems.map((community, index) => (
            <CommunityPreview community={community} index={index} key={community._id || community.id || `preview-${index}`} />
          ))}
          <CommunityCard community={selectedItem} selected onClick={() => setExpanded(true)} />
        </div>
      )}
    </section>
  );
}

function CommunityCard({ community, selected, onClick }) {
  const name = community.displayName || community.name || "Yenkasa";
  const image = community.coverImage || community.icon || community.image;
  return (
    <span
      role="button"
      tabIndex={0}
      className={`player-community-card${community.isAll ? " player-community-card--all" : ""}${selected ? " is-selected" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick?.();
      }}
    >
      {image ? (
        <img src={image} alt="" loading="lazy" onError={handleDynamicImageError} />
      ) : (
        <span className="player-community-card__fallback">{community.isAll ? "All" : initials(name)}</span>
      )}
      <span className="player-community-card__shade" />
      {selected ? <span className="player-community-card__check">✓</span> : null}
      <strong>{name}</strong>
      <small><i />{community.isAll ? "Live" : formatCompact(community.memberCount || community.membersCount || 0)}</small>
    </span>
  );
}

function CommunityPreview({ community, index }) {
  const name = community.displayName || community.name || "Y";
  const image = community.coverImage || community.icon || community.image;
  return (
    <span className={`player-community-preview player-community-preview--${index + 1}`} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" onError={handleDynamicImageError} /> : initials(name)}
    </span>
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

function formatCompact(value) {
  const number = Number(value || 0);
  if (!number) return "Live";
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 1 : 1)}K`;
  return String(number);
}
