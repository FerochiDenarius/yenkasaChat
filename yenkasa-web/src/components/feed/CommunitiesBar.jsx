import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const fallbackCommunities = [
  { _id: "all", name: "Music Lovers Ghana", country: "Ghana" },
  { _id: "health", name: "Health & Wellness Ghana", country: "Ghana" },
  { _id: "young", name: "Young Entrepreneurs", country: "Ghana" },
  { _id: "creative", name: "Creative Artists Hub", country: "Ghana" }
];

export default function CommunitiesBar({
  selectedCommunityId = null,
  onSelectCommunity,
}) {
  const [communities, setCommunities] = useState([]);

  useEffect(() => {
    let mounted = true;

    api.get("/communities/public", { params: { country: "Ghana" } })
      .then(({ data }) => {
        if (!mounted) return;
        const items = Array.isArray(data) ? data : [];
        setCommunities(items);
      })
      .catch(() => {
        if (mounted) setCommunities([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => {
    return communities.length ? communities : fallbackCommunities;
  }, [communities]);

  return (
    <section className="communities-bar">
      <div className="communities-bar__scroller">
        <button
          className={`communities-bar__all${
            !selectedCommunityId ? " communities-bar__all--active" : ""
          }`}
          type="button"
          onClick={() => onSelectCommunity?.(null)}
        >
          <span className="communities-bar__all-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6" height="6" rx="1.5" />
              <rect x="14" y="4" width="6" height="6" rx="1.5" />
              <rect x="4" y="14" width="6" height="6" rx="1.5" />
              <rect x="14" y="14" width="6" height="6" rx="1.5" />
            </svg>
          </span>
          <span>All Communities</span>
        </button>

        {items.map((community, index) => (
          <button
            className={`community-pill${
              String(community._id || community.id || "") ===
              String(selectedCommunityId || "")
                ? " community-pill--active"
                : ""
            }`}
            key={community._id || community.id || index}
            type="button"
            onClick={() => onSelectCommunity?.(community)}
          >
            <span className="community-pill__avatar">
              {community.icon || community.coverImage ? (
                <img
                  src={community.icon || community.coverImage}
                  alt={community.displayName || community.name || "Community"}
                />
              ) : (
                <span>{initials(community.displayName || community.name)}</span>
              )}
            </span>
            <span className="community-pill__name">
              {community.displayName || community.name || "Community"}
            </span>
          </button>
        ))}
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
