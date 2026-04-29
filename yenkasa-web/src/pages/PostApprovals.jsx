import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  approvePostApproval,
  getPendingPostApprovals,
  rejectPostApproval,
} from "../api/postApprovals";
import BottomNav from "../components/feed/BottomNav";
import {
  buildAudioUrl,
  buildMediaUrl,
  buildVideoUrl,
  formatRelativeTime,
} from "../utils/format";
import { handleDynamicImageError, handleStaticImageError, staticImage } from "../utils/images";
import { requestWalletRefresh } from "../utils/walletEvents";

export default function PostApprovals() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    setLoading(true);
    setError("");

    try {
      const pending = await getPendingPostApprovals();
      setItems(pending);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Could not load pending posts."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(item, action) {
    const approvalId = item?._id;
    if (!approvalId || busyId) return;

    setBusyId(approvalId);
    setError("");
    setMessage("");

    try {
      const result =
        action === "approve"
          ? await approvePostApproval(approvalId)
          : await rejectPostApproval(approvalId);

      setItems((current) => current.filter((entry) => entry?._id !== approvalId));
      setMessage(result?.message || (action === "approve" ? "Post approved." : "Post rejected."));
      requestWalletRefresh(action === "approve" ? "post_approved" : "post_rejected");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          `Failed to ${action} post.`
      );
    } finally {
      setBusyId("");
    }
  }

  const pendingCount = useMemo(() => items.filter(Boolean).length, [items]);

  return (
    <main className="page page--with-nav moderation-page">
      <header className="page-header">
        <div className="page-header__row">
          <button
            type="button"
            className="page-header__back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>
          <div>
            <span className="page-header__eyebrow">Moderation</span>
            <h1>Post Approvals</h1>
            <p>Review pending community posts before they go live.</p>
          </div>
        </div>
      </header>

      <section className="moderation-summary">
        <div>
          <span>Pending queue</span>
          <strong>{pendingCount}</strong>
        </div>
        <button type="button" className="secondary-btn" onClick={loadPending} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}

      {loading ? <div className="feed-status-card">Loading pending posts...</div> : null}

      {!loading && !items.length && !error ? (
        <section className="empty-state">
          <h2>No pending posts</h2>
          <p className="muted">The approval queue is clear.</p>
        </section>
      ) : null}

      <section className="moderation-list">
        {items.map((item) => (
          <ApprovalCard
            key={item?._id}
            item={item}
            busy={busyId === item?._id}
            onApprove={() => handleDecision(item, "approve")}
            onReject={() => handleDecision(item, "reject")}
            onOpenUser={(userId) => navigate(`/profile/${userId}`)}
          />
        ))}
      </section>

      <BottomNav />
    </main>
  );
}

function ApprovalCard({ item, busy, onApprove, onReject, onOpenUser }) {
  const post = item?.post || {};
  const author = post?.userId || item?.user || {};
  const authorId = author?._id || author?.id || post?.userId?._id || post?.userId;
  const username = author?.username || "Yenkasa User";
  const avatar = author?.profileImage || author?.profileImageUrl || null;
  const content = post?.text || item?.caption || "";
  const communityName =
    post?.communityId?.displayName ||
    post?.communityId?.name ||
    post?.communityName ||
    "Yenkasa";
  const mediaUrl = buildMediaUrl(post) || item?.imageUrl || item?.imageUrls?.[0] || "";
  const videoUrl = buildVideoUrl(post) || item?.videoUrl || "";
  const audioUrl = buildAudioUrl(post) || item?.audioUrl || "";
  const textBackgroundColor = post?.textBackgroundColor || item?.textBackgroundColor || "";

  return (
    <article className="moderation-card">
      <header className="moderation-card__header">
        <button
          type="button"
          className="moderation-card__author"
          onClick={() => authorId && onOpenUser(authorId)}
          disabled={!authorId}
        >
          <span className="feed-post-card__avatar">
            {avatar ? (
              <img src={avatar} alt={username} onError={handleDynamicImageError} />
            ) : (
              <span>{username.charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span>
            <strong>
              {username}
              {author?.verified || author?.roleName === "verified" ? (
                <img
                  className="feed-verified-badge"
                  src={staticImage("verified.png")}
                  alt="Verified"
                  onError={(event) => handleStaticImageError(event, "verified.png")}
                />
              ) : null}
            </strong>
            <small>
              {communityName} · {formatRelativeTime(item?.submittedAt || post?.createdAt)}
            </small>
          </span>
        </button>
        <span className="tag">Pending</span>
      </header>

      {content ? (
        <div
          className={`moderation-card__text${textBackgroundColor ? " has-background" : ""}`}
          style={textBackgroundColor ? { background: textBackgroundColor } : undefined}
        >
          {content}
        </div>
      ) : null}

      {videoUrl ? (
        <div className="moderation-card__media">
          <video src={videoUrl} controls preload="metadata" playsInline />
        </div>
      ) : audioUrl ? (
        <div className="moderation-card__audio">
          <span>Audio post</span>
          <audio src={audioUrl} controls preload="metadata" />
        </div>
      ) : mediaUrl ? (
        <div className="moderation-card__media">
          <img src={mediaUrl} alt={content || username} onError={handleDynamicImageError} />
        </div>
      ) : null}

      <footer className="moderation-card__actions">
        <button type="button" className="secondary-btn moderation-card__reject" onClick={onReject} disabled={busy}>
          Reject
        </button>
        <button type="button" className="primary-btn" onClick={onApprove} disabled={busy}>
          {busy ? "Working..." : "Approve"}
        </button>
      </footer>
    </article>
  );
}
