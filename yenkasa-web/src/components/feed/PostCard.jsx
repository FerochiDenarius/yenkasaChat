import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import {
  buildAudioUrl,
  buildMediaUrl,
  buildVideoUrl,
  formatRelativeTime,
} from "../../utils/format";
import { handleDynamicImageError, handleStaticImageError, staticImage } from "../../utils/images";
import { getStoredUser } from "../../utils/storage";
import { requestWalletRefresh } from "../../utils/walletEvents";

export default function PostCard({ post, onUpdate, detailMode = false }) {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const currentUser = useMemo(() => getStoredUser() || {}, []);
  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [pendingCommentLikes, setPendingCommentLikes] = useState(() => new Set());

  const liked = post?.likedByUser === true;
  const mediaUrl = buildMediaUrl(post);
  const videoUrl = buildVideoUrl(post);
  const audioUrl = buildAudioUrl(post);
  const username = post?.userId?.username || post?.username || "Yenkasa User";
  const communityName =
    post?.communityId?.displayName || post?.communityId?.name || "Yenkasa";
  const content = post?.text || post?.caption || "";
  const commentCount = Number(post?.commentCount || 0);
  const shareCount = Number(post?.shareCount || 0);
  const likeCount = Number(post?.likeCount || 0);
  const viewCount = Number(post?.viewCount || post?.viewsCount || 0);
  const authorAvatar =
    post?.userId?.profileImage ||
    post?.userId?.profileImageUrl ||
    post?.userId?.avatar ||
    null;
  const authorId = post?.userId?._id || post?.userId?.id || post?.userId || post?.authorId || "";
  const isVideoPost =
    Boolean(videoUrl) ||
    String(post?.postType || "").toLowerCase() === "video";
  const isAudioPost =
    Boolean(audioUrl) ||
    String(post?.postType || "").toLowerCase() === "audio";

  const visibleComments = useMemo(() => comments.filter(Boolean), [comments]);
  const viewMediaType = isVideoPost ? "video" : isAudioPost ? "audio" : mediaUrl ? "image" : "text";

  useEffect(() => {
    if (!post?._id || !cardRef.current) return undefined;
    const viewedKey = "yenkasa_viewed_post_ids";
    const existing = readViewedPostIds(viewedKey);
    if (existing.has(post._id)) return undefined;

    const delayByType = {
      image: 3000,
      video: 10000,
      audio: 5000,
      text: 5000,
    };
    const watchDurationByType = {
      image: 3,
      video: 10,
      audio: 5,
      text: 5,
    };

    let timerId = null;
    let recorded = false;

    async function recordView() {
      if (recorded) return;
      recorded = true;
      existing.add(post._id);
      writeViewedPostIds(viewedKey, existing);

      try {
        const { data } = await api.post(`/views/${post._id}/view`, {
          mediaType: viewMediaType,
          watchDuration: watchDurationByType[viewMediaType] || 0,
        });

        if (Number.isFinite(Number(data?.viewCount))) {
          onUpdate?.(post._id, { viewCount: Number(data.viewCount) });
        }
        requestWalletRefresh("post_view");
      } catch {
        existing.delete(post._id);
        writeViewedPostIds(viewedKey, existing);
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!timerId) {
            timerId = window.setTimeout(recordView, delayByType[viewMediaType] || 5000);
          }
          return;
        }

        if (timerId) {
          window.clearTimeout(timerId);
          timerId = null;
        }
      },
      { threshold: [0, 0.6] }
    );

    observer.observe(cardRef.current);

    return () => {
      if (timerId) window.clearTimeout(timerId);
      observer.disconnect();
    };
  }, [post?._id, viewMediaType, onUpdate]);

  function openPost() {
    if (detailMode || !post?._id) return;
    navigate(`/post/${post._id}`);
  }

  function openUserProfile(userId) {
    const id = String(userId || "");
    if (!id) return;
    navigate(`/profile/${id}`);
  }

  async function handleLike() {
    if (busy || !post?._id) return;
    setBusy(true);

    const nextLiked = !liked;
    const optimisticLikeCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    onUpdate?.(post._id, {
      likedByUser: nextLiked,
      likeCount: optimisticLikeCount,
    });

    try {
      const { data } = await api.post(`/social/like/${post._id}`);
      onUpdate?.(post._id, {
        likedByUser: Boolean(data?.likedByUser),
        likeCount: Number(data?.likeCount ?? optimisticLikeCount),
      });
      if (data?.likedByUser) requestWalletRefresh("post_like");
    } catch {
      onUpdate?.(post._id, {
        likedByUser: liked,
        likeCount,
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleComments() {
    const nextOpen = !commentOpen;
    setCommentOpen(nextOpen);

    if (!nextOpen || !post?._id || visibleComments.length || commentsLoading) return;

    setCommentsLoading(true);
    setCommentsError("");

    try {
      const { data } = await api.get(`/comments/post/${post._id}`);
      const incoming = Array.isArray(data?.comments) ? data.comments : [];
      setComments(incoming);
    } catch {
      setCommentsError("Could not load comments right now.");
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleSubmitComment(event) {
    event.preventDefault();
    if (!post?._id || !commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    setCommentsError("");

    try {
      const { data } = await api.post("/comments", {
        postId: post._id,
        text: commentText.trim(),
      });

      if (data?.comment) {
        setComments((prev) => [...prev, data.comment]);
      }
      setCommentText("");
      setCommentOpen(true);
      onUpdate?.(post._id, {
        commentCount: commentCount + 1,
      });
      requestWalletRefresh("comment");
    } catch {
      setCommentsError("Failed to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleCommentLike(comment) {
    const commentId = comment?._id;
    if (!commentId || pendingCommentLikes.has(commentId)) return;

    const liked = isCommentLiked(comment, currentUserId);
    const nextLiked = !liked;
    const originalLikeCount = getCommentLikeCount(comment);
    const nextLikeCount = Math.max(0, originalLikeCount + (nextLiked ? 1 : -1));
    const originalLikes = Array.isArray(comment?.likes) ? comment.likes : [];
    const nextLikes = updateLikesList(originalLikes, currentUserId, nextLiked);

    setPendingCommentLikes((prev) => new Set(prev).add(commentId));
    setComments((prev) =>
      prev.map((item) =>
        item?._id === commentId
          ? { ...item, likedByUser: nextLiked, likes: nextLikes, likeCount: nextLikeCount }
          : item
      )
    );

    try {
      const { data } = await api.post("/comments/toggle-like", {
        commentId,
        like: nextLiked,
      });

      setComments((prev) =>
        prev.map((item) =>
          item?._id === commentId
            ? {
                ...item,
                likedByUser: Boolean(data?.liked ?? nextLiked),
                likes: updateLikesList(
                  Array.isArray(item?.likes) ? item.likes : [],
                  currentUserId,
                  Boolean(data?.liked ?? nextLiked)
                ),
                likeCount: Number(data?.likeCount ?? nextLikeCount),
              }
            : item
        )
      );
      if (data?.liked ?? nextLiked) requestWalletRefresh("comment_like");
    } catch {
      setComments((prev) =>
        prev.map((item) =>
          item?._id === commentId
            ? {
                ...item,
                likedByUser: liked,
                likes: originalLikes,
                likeCount: originalLikeCount,
              }
            : item
        )
      );
      setCommentsError("Failed to update comment like.");
    } finally {
      setPendingCommentLikes((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  }

  async function handleShare() {
    if (!post?._id || sharing) return;

    const shareUrl = `${window.location.origin}/web/post/${post._id}`;
    const shareText = content || "Check out this post on Yenkasa.";
    const previousShareCount = shareCount;
    const nextShareCount = previousShareCount + 1;

    setSharing(true);
    setShareStatus("");
    onUpdate?.(post._id, { shareCount: nextShareCount });

    try {
      const { data } = await api.post(`/posts/${post._id}/share`);
      if (Number.isFinite(Number(data?.shareCount))) {
        onUpdate?.(post._id, { shareCount: Number(data.shareCount) });
      }
      requestWalletRefresh("post_share");
    } catch {
      onUpdate?.(post._id, { shareCount: previousShareCount });
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: username,
          text: shareText,
          url: shareUrl,
        });
        setShareStatus("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setShareStatus("Post link copied");
      } else {
        window.prompt("Copy this post link:", shareUrl);
        setShareStatus("Copy the post link");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        try {
          await navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`);
          setShareStatus("Post link copied");
        } catch {
          window.prompt("Copy this post link:", shareUrl);
          setShareStatus("Copy the post link");
        }
      }
    } finally {
      setSharing(false);
      window.setTimeout(() => setShareStatus(""), 2500);
    }
  }

  return (
    <article className="feed-post-card" ref={cardRef}>
      <header className="feed-post-card__header">
        <button
          type="button"
          className="feed-post-card__author-block feed-post-card__author-button"
          onClick={() => openUserProfile(authorId)}
          disabled={!authorId}
        >
          <span className="feed-post-card__avatar">
            {authorAvatar ? (
              <img src={authorAvatar} alt={username} onError={useDefaultImage} />
            ) : (
              <span>{username.charAt(0).toUpperCase()}</span>
            )}
          </span>

          <div className="feed-post-card__author-meta">
            <div className="feed-post-card__author-line">
              <strong>{username}</strong>
              {post?.userId?.verified || post?.userId?.roleName === "verified" ? (
                <img
                  className="feed-verified-badge"
                  src={staticImage("verified.png")}
                  alt="Verified"
                  onError={(event) => handleStaticImageError(event, "verified.png")}
                />
              ) : null}
            </div>
            <p>
              {communityName} <span>•</span> {formatRelativeTime(post?.createdAt)}
            </p>
          </div>
        </button>

        <button
          className="feed-icon-btn feed-icon-btn--ghost"
          type="button"
          aria-label="More options"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </header>

      {content ? (
        <button
          type="button"
          className="feed-post-card__content-button"
          onClick={openPost}
          disabled={detailMode}
        >
          <p className="feed-post-card__content">{content}</p>
        </button>
      ) : null}

      {isVideoPost ? (
        <button
          type="button"
          className="feed-post-card__media-button"
          onClick={openPost}
          disabled={detailMode}
        >
          <div className="feed-post-card__media feed-post-card__media--video">
            <video
              src={videoUrl}
              poster={mediaUrl && mediaUrl !== videoUrl ? mediaUrl : undefined}
              controls
              preload="metadata"
              playsInline
            />
            <span className="feed-post-card__media-badge">Video</span>
          </div>
        </button>
      ) : isAudioPost ? (
        <div className="feed-post-card__audio">
          <div className="feed-post-card__audio-icon">♪</div>
          <div>
            <strong>Audio post</strong>
            <span>{content || "Listen to this Yenkasa audio update."}</span>
          </div>
          <audio src={audioUrl} controls preload="metadata" />
        </div>
      ) : mediaUrl ? (
        <button
          type="button"
          className="feed-post-card__media-button"
          onClick={openPost}
          disabled={detailMode}
        >
          <div className="feed-post-card__media">
            <img src={mediaUrl} alt={content || username} onError={useDefaultImage} />
          </div>
        </button>
      ) : (
        <button
          type="button"
          className="feed-post-card__text-panel-button"
          onClick={openPost}
          disabled={detailMode}
        >
          <div className="feed-post-card__text-panel">
            <span>{content || "Share something with your community."}</span>
          </div>
        </button>
      )}

      {!detailMode ? (
        <button
          type="button"
          className="feed-post-card__stats-button"
          onClick={openPost}
        >
          <div className="feed-post-card__stats">
            <span>{likeCount} likes</span>
            <span>{commentCount} comments</span>
            <span>{viewCount} views</span>
            <span>{shareCount} shares</span>
          </div>
        </button>
      ) : (
        <div className="feed-post-card__stats">
          <span>{likeCount} likes</span>
          <span>{commentCount} comments</span>
          <span>{viewCount} views</span>
          <span>{shareCount} shares</span>
        </div>
      )}

      <footer className="feed-post-card__actions">
        <button
          type="button"
          className={`feed-post-card__action${liked ? " is-active" : ""}`}
          onClick={handleLike}
        >
          <span>♡</span>
          <span>{liked ? "Liked" : "Like"}</span>
        </button>
        <button
          type="button"
          className={`feed-post-card__action${commentOpen ? " is-active" : ""}`}
          onClick={toggleComments}
        >
          <span>◔</span>
          <span>Comment</span>
        </button>
        <button
          type="button"
          className={`feed-post-card__action${sharing ? " is-active" : ""}`}
          onClick={handleShare}
          disabled={sharing}
        >
          <span>↗</span>
          <span>{sharing ? "Sharing" : "Share"}</span>
        </button>
        <button type="button" className="feed-post-card__action" onClick={openPost}>
          <span>⌑</span>
        </button>
      </footer>

      {shareStatus ? <div className="feed-share-status">{shareStatus}</div> : null}

      {commentOpen ? (
        <section className="feed-comments-panel">
          <form className="feed-comment-form" onSubmit={handleSubmitComment}>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Write a comment..."
              rows={2}
            />
            <button type="submit" disabled={submittingComment || !commentText.trim()}>
              {submittingComment ? "Posting..." : "Post"}
            </button>
          </form>

          {commentsLoading ? (
            <div className="feed-comments-state">Loading comments...</div>
          ) : null}

          {commentsError ? (
            <div className="feed-comments-error">{commentsError}</div>
          ) : null}

          {!commentsLoading && !visibleComments.length ? (
            <div className="feed-comments-state">
              No comments yet. Start the conversation.
            </div>
          ) : null}

          {visibleComments.length ? (
            <div className="feed-comments-list">
              {visibleComments.map((comment) => {
                const commentAuthor =
                  comment?.userId?.username || comment?.username || "Yenkasa User";
                const commentAvatar =
                  comment?.userId?.profileImage || comment?.userId?.profileImageUrl || null;
                const commentAuthorId =
                  comment?.userId?._id || comment?.userId?.id || comment?.userId || "";
                const commentLiked = isCommentLiked(comment, currentUserId);
                const commentLikeCount = getCommentLikeCount(comment);
                const commentPending = pendingCommentLikes.has(comment?._id);

                return (
                  <article
                    className="feed-comment"
                    key={comment?._id || `${commentAuthor}-${comment?.createdAt}`}
                  >
                    <button
                      type="button"
                      className="feed-comment__avatar feed-comment__avatar-button"
                      onClick={() => openUserProfile(commentAuthorId)}
                      disabled={!commentAuthorId}
                    >
                      {commentAvatar ? (
                        <img src={commentAvatar} alt={commentAuthor} onError={useDefaultImage} />
                      ) : (
                        <span>{commentAuthor.charAt(0).toUpperCase()}</span>
                      )}
                    </button>
                    <div className="feed-comment__body">
                      <div className="feed-comment__meta">
                        <button
                          type="button"
                          onClick={() => openUserProfile(commentAuthorId)}
                          disabled={!commentAuthorId}
                        >
                          {commentAuthor}
                        </button>
                        <span>{formatRelativeTime(comment?.createdAt)}</span>
                      </div>
                      <p>{comment?.text || ""}</p>
                      <div className="feed-comment__actions">
                        <button
                          type="button"
                          className={commentLiked ? "is-active" : ""}
                          onClick={() => handleCommentLike(comment)}
                          disabled={commentPending}
                        >
                          {commentLiked ? "Liked" : "Like"}
                        </button>
                        <span>{commentLikeCount} likes</span>
                        {comment?.replyCount ? <span>{comment.replyCount} replies</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function useDefaultImage(event) {
  handleDynamicImageError(event);
}

function isCommentLiked(comment, currentUserId) {
  if (comment?.likedByUser === true || comment?.liked === true) return true;
  if (!currentUserId || !Array.isArray(comment?.likes)) return false;
  return comment.likes.some((item) => {
    const id = typeof item === "string" ? item : item?._id || item?.id;
    return String(id || "") === currentUserId;
  });
}

function getCommentLikeCount(comment) {
  const likeCount = Number(comment?.likeCount);
  if (Number.isFinite(likeCount)) return likeCount;
  return Array.isArray(comment?.likes) ? comment.likes.length : 0;
}

function updateLikesList(likes, currentUserId, shouldLike) {
  if (!currentUserId) return likes;
  const existing = likes.filter(Boolean);
  const hasUser = existing.some((item) => {
    const id = typeof item === "string" ? item : item?._id || item?.id;
    return String(id || "") === currentUserId;
  });

  if (shouldLike && !hasUser) return [...existing, currentUserId];
  if (!shouldLike && hasUser) {
    return existing.filter((item) => {
      const id = typeof item === "string" ? item : item?._id || item?.id;
      return String(id || "") !== currentUserId;
    });
  }

  return existing;
}

function readViewedPostIds(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeViewedPostIds(key, values) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(Array.from(values).slice(-300)));
  } catch {
    // Session storage may be unavailable in private browsing.
  }
}
