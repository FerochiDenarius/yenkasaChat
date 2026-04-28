import { useState } from "react";
import { toggleLike } from "../api/feed";
import { buildMediaUrl, formatRelativeTime, getAuthorName } from "../utils/format";

export default function PostCard({ post, onOptimisticLike }) {
  const [busy, setBusy] = useState(false);
  const imageUrl = buildMediaUrl(post);
  const likedByUser = post?.likedByUser === true;

  async function handleLike() {
    if (busy) return;
    setBusy(true);

    const nextLiked = !likedByUser;
    const nextCount = Math.max(0, Number(post?.likeCount || 0) + (nextLiked ? 1 : -1));

    onOptimisticLike?.(post._id, nextLiked, nextCount);

    try {
      await toggleLike(post._id);
    } catch (error) {
      onOptimisticLike?.(post._id, likedByUser, Number(post?.likeCount || 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card post-card">
      <header className="post-card__header">
        <div>
          <p className="post-card__author">{getAuthorName(post)}</p>
          <p className="post-card__meta">{formatRelativeTime(post?.createdAt)}</p>
        </div>
        {post?.communityName ? <span className="tag">{post.communityName}</span> : null}
      </header>

      {post?.text ? <p className="post-card__body">{post.text}</p> : null}

      {imageUrl ? (
        <div className="post-card__media">
          <img src={imageUrl} alt={post?.text || "Post media"} />
        </div>
      ) : null}

      <footer className="post-card__footer">
        <button className={`action-btn${likedByUser ? " action-btn--liked" : ""}`} onClick={handleLike}>
          {likedByUser ? "Liked" : "Like"} · {post?.likeCount || 0}
        </button>
        <span className="muted">Comments {post?.commentCount || 0}</span>
      </footer>
    </article>
  );
}
