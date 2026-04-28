import { useState } from "react";
import api from "../../api/client";
import { buildMediaUrl, formatRelativeTime } from "../../utils/format";

export default function PostCard({ post, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const liked = post?.likedByUser === true;
  const mediaUrl = buildMediaUrl(post);
  const username = post?.userId?.username || post?.username || "Yenkasa User";
  const communityName = post?.communityId?.displayName || post?.communityId?.name || "Yenkasa";
  const content = post?.text || post?.caption || "";

  async function handleLike() {
    if (busy || !post?._id) return;
    setBusy(true);

    const nextLiked = !liked;
    const nextLikeCount = Math.max(0, Number(post?.likeCount || 0) + (nextLiked ? 1 : -1));
    onUpdate?.(post._id, { likedByUser: nextLiked, likeCount: nextLikeCount });

    try {
      await api.post(`/social/like/${post._id}`);
    } catch {
      onUpdate?.(post._id, { likedByUser: liked, likeCount: Number(post?.likeCount || 0) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="feed-post-card">
      <header className="feed-post-card__header">
        <div className="feed-post-card__author-block">
          <span className="feed-post-card__avatar">
            {post?.userId?.profileImage ? (
              <img src={post.userId.profileImage} alt={username} />
            ) : (
              <span>{username.charAt(0).toUpperCase()}</span>
            )}
          </span>

          <div className="feed-post-card__author-meta">
            <div className="feed-post-card__author-line">
              <strong>{username}</strong>
              {(post?.userId?.verified || post?.userId?.roleName === "verified") ? (
                <span className="feed-verified-badge">✓</span>
              ) : null}
            </div>
            <p>
              {communityName} <span>•</span> {formatRelativeTime(post?.createdAt)}
            </p>
          </div>
        </div>

        <button className="feed-icon-btn feed-icon-btn--ghost" type="button" aria-label="More options">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </header>

      {content ? <p className="feed-post-card__content">{content}</p> : null}

      {mediaUrl ? (
        <div className="feed-post-card__media">
          <img src={mediaUrl} alt={content || username} />
        </div>
      ) : (
        <div className="feed-post-card__text-panel">
          <span>{content || "Share something with your community."}</span>
        </div>
      )}

      <div className="feed-post-card__stats">
        <span>{Number(post?.likeCount || 0)} likes</span>
        <span>{Number(post?.commentCount || 0)} comments</span>
        <span>{Number(post?.shareCount || 0)} shares</span>
      </div>

      <footer className="feed-post-card__actions">
        <button type="button" className={`feed-post-card__action${liked ? " is-active" : ""}`} onClick={handleLike}>
          <span>♡</span>
          <span>{liked ? "Liked" : "Like"}</span>
        </button>
        <button type="button" className="feed-post-card__action">
          <span>◔</span>
          <span>Comment</span>
        </button>
        <button type="button" className="feed-post-card__action">
          <span>↗</span>
          <span>Share</span>
        </button>
        <button type="button" className="feed-post-card__action">
          <span>⌑</span>
        </button>
      </footer>
    </article>
  );
}
