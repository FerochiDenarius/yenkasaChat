import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import { handleDynamicImageError, staticImage } from "../../utils/images";

const fallbackCommunities = [
  { _id: "afrobeats", name: "Afrobeats", memberCount: 23100 },
  { _id: "chill", name: "Chill Vibes", memberCount: 18700 },
  { _id: "gospel", name: "Gospel", memberCount: 12400 },
  { _id: "street", name: "Street Talk", memberCount: 9800 },
  { _id: "tv", name: "Yenkasa TV", memberCount: 15600, icon: staticImage("logo.png") },
];

export default function YenkasaWebCommunityStrip({ selectedCommunityId, onSelectCommunity }) {
  const [communities, setCommunities] = useState([]);

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

  return (
    <section className="player-community-strip" aria-label="Communities">
      <div className="player-community-strip__header">
        <strong>Communities</strong>
        <button type="button" onClick={() => onSelectCommunity?.(null)}>
          See all <span>›</span>
        </button>
      </div>
      <div className="player-community-strip__list">
        {items.slice(0, 8).map((community, index) => {
          const id = community._id || community.id || index;
          const name = community.displayName || community.name || "Yenkasa";
          const image = community.coverImage || community.icon || community.image;
          const selected = String(id) === String(selectedCommunityId || "");

          return (
            <button
              type="button"
              className={`player-community-card${selected ? " is-selected" : ""}`}
              key={id}
              onClick={() => onSelectCommunity?.(community)}
            >
              {image ? (
                <img src={image} alt="" loading="lazy" onError={handleDynamicImageError} />
              ) : (
                <span className="player-community-card__fallback">{initials(name)}</span>
              )}
              <span className="player-community-card__shade" />
              <strong>{name}</strong>
              <small><i />{formatCompact(community.memberCount || community.membersCount || 0)}</small>
            </button>
          );
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

function formatCompact(value) {
  const number = Number(value || 0);
  if (!number) return "Live";
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 1 : 1)}K`;
  return String(number);
}
