import { buildMediaUrl, buildVideoUrl, formatRelativeTime } from "../utils/format";

export default function AdCard({ ad, compact = false }) {
  const mediaUrl = buildMediaUrl(ad);
  const videoUrl = buildVideoUrl(ad);
  const statusLabel = ad?.approvalStatus || (ad?.isActive ? "approved" : "pending");

  return (
    <article className={`card ad-card${compact ? " ad-card--compact" : ""}`}>
      <div className="split-row">
        <div>
          <h3>{ad?.title || "Sponsored ad"}</h3>
          <p className="muted">
            {statusLabel} · {formatRelativeTime(ad?.createdAt)}
          </p>
        </div>
        {ad?.rewardYKC ? <span className="tag">{ad.rewardYKC} YKC</span> : null}
      </div>

      {mediaUrl ? (
        <div className="ad-card__media">
          <img
            src={mediaUrl}
            alt={ad?.title || "Ad preview"}
            onError={(event) => {
              event.currentTarget.src = "/images/default.png";
            }}
          />
          {!ad?.imageUrl && videoUrl ? <span className="tag ad-card__type-tag">Video</span> : null}
        </div>
      ) : null}

      {ad?.sponsorName ? <p className="muted">By {ad.sponsorName}</p> : null}
      {ad?.ctaText ? <button className="secondary-btn">{ad.ctaText}</button> : null}
      {ad?.rejectionReason ? <p className="error-copy">Reason: {ad.rejectionReason}</p> : null}
    </article>
  );
}
