import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import {
  buildAudioUrl,
  buildCanonicalPostUrl,
  buildMediaUrl,
  buildPosterUrl,
  buildVideoUrl,
  formatRelativeTime,
} from "../../utils/format";
import { handleStaticImageError, staticImage } from "../../utils/images";
import { requestWalletRefresh } from "../../utils/walletEvents";
import YenkasaWebPlayerActions from "./YenkasaWebPlayerActions";
import YenkasaWebPlayerControls from "./YenkasaWebPlayerControls";

export default function YenkasaWebPlayerCard({ post, active, onUpdate }) {
  const navigate = useNavigate();
  const mediaRef = useRef(null);
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saved, setSaved] = useState(Boolean(post?.savedByUser));
  const [shareStatus, setShareStatus] = useState("");

  const mediaUrl = buildMediaUrl(post);
  const videoUrl = buildVideoUrl(post);
  const posterUrl = buildPosterUrl(post);
  const audioUrl = buildAudioUrl(post);
  const postType = String(post?.postType || post?.type || "").toLowerCase();
  const isVideo = Boolean(videoUrl) || postType === "video";
  const isAudio = Boolean(audioUrl) || postType === "audio";
  const isImage = !isVideo && !isAudio && Boolean(mediaUrl);
  const isText = !isVideo && !isAudio && !isImage;
  const source = isVideo ? videoUrl : isAudio ? audioUrl : mediaUrl;
  const content = post?.text || post?.caption || post?.content || "";
  const author = post?.userId || post?.author || {};
  const username = author?.username || post?.username || "Yenkasa User";
  const authorId = author?._id || author?.id || post?.authorId || "";
  const authorAvatar = author?.profileImage || author?.profileImageUrl || author?.avatar;
  const communityName = post?.communityId?.displayName || post?.communityId?.name || post?.communityName || "Yenkasa";
  const liked = post?.likedByUser === true;
  const mediaKind = isVideo ? "video" : isAudio ? "audio" : isImage ? "image" : "text";

  const textStyle = useMemo(() => {
    const background = post?.background || post?.backgroundColor || post?.textBackground;
    return background ? { background } : undefined;
  }, [post]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (active) {
      media.play?.().catch(() => {});
    } else {
      media.pause?.();
    }
  }, [active, source]);

  useEffect(() => {
    if (!post?._id || !cardRef.current) return undefined;
    const viewedKey = "yenkasa_player_viewed_post_ids";
    const existing = readViewedPostIds(viewedKey);
    if (existing.has(post._id)) return undefined;

    const delay = { image: 3000, video: 10000, audio: 5000, text: 5000 }[mediaKind] || 5000;
    const watchDuration = { image: 3, video: 10, audio: 5, text: 5 }[mediaKind] || 5;
    let timerId = null;
    let recorded = false;

    async function recordView() {
      if (recorded) return;
      recorded = true;
      existing.add(post._id);
      writeViewedPostIds(viewedKey, existing);

      try {
        const { data } = await api.post(`/views/${post._id}/view`, {
          mediaType: mediaKind,
          watchDuration,
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
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          if (!timerId) timerId = window.setTimeout(recordView, delay);
        } else if (timerId) {
          window.clearTimeout(timerId);
          timerId = null;
        }
      },
      { threshold: [0, 0.65] }
    );

    observer.observe(cardRef.current);
    return () => {
      if (timerId) window.clearTimeout(timerId);
      observer.disconnect();
    };
  }, [post?._id, mediaKind, onUpdate]);

  async function handleLike() {
    if (busy || !post?._id) return;
    setBusy(true);
    const nextLiked = !liked;
    const nextLikeCount = Math.max(0, Number(post?.likeCount || 0) + (nextLiked ? 1 : -1));
    onUpdate?.(post._id, { likedByUser: nextLiked, likeCount: nextLikeCount });

    try {
      const { data } = await api.post(`/social/like/${post._id}`);
      onUpdate?.(post._id, {
        likedByUser: Boolean(data?.likedByUser),
        likeCount: Number(data?.likeCount ?? nextLikeCount),
      });
      if (data?.likedByUser) requestWalletRefresh("post_like");
    } catch {
      onUpdate?.(post._id, { likedByUser: liked, likeCount: Number(post?.likeCount || 0) });
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!post?._id || sharing) return;
    const shareUrl = buildCanonicalPostUrl(post._id);
    const shareText = content || "Check out this post on Yenkasa.";
    const previousShareCount = Number(post?.shareCount || 0);

    setSharing(true);
    onUpdate?.(post._id, { shareCount: previousShareCount + 1 });
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
        await navigator.share({ title: username, text: shareText, url: shareUrl });
        setShareStatus("Shared");
      } else {
        await navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`);
        setShareStatus("Post link copied");
      }
    } catch {
      setShareStatus("");
    } finally {
      setSharing(false);
      window.setTimeout(() => setShareStatus(""), 2200);
    }
  }

  function handleSave() {
    setSaved((current) => !current);
    // TODO: Replace this local save state with a backend bookmark endpoint when available.
  }

  return (
    <article ref={cardRef} className={`player-card player-card--${mediaKind}${active ? " is-active" : ""}`}>
      <div className="player-card__media">
        {isVideo ? (
          <video
            ref={mediaRef}
            src={source}
            poster={posterUrl && posterUrl !== videoUrl ? posterUrl : undefined}
            playsInline
            loop
            muted
            preload={active ? "auto" : "metadata"}
          />
        ) : isAudio ? (
          <AudioPanel mediaRef={mediaRef} source={source} post={post} username={username} />
        ) : isImage ? (
          <img src={source} alt={content || username} loading={active ? "eager" : "lazy"} />
        ) : (
          <div className="player-card__text" style={textStyle}>
            <p>{content || "Share something with your community."}</p>
          </div>
        )}
        <span className="player-card__shade" />
      </div>

      <YenkasaWebPlayerActions
        post={post}
        liked={liked}
        saved={saved}
        busy={busy}
        sharing={sharing}
        onLike={handleLike}
        onComment={() => navigate(`/post/${post._id}?openComments=true`)}
        onShare={handleShare}
        onSave={handleSave}
        onCreateSponsoredAd={() => navigate("/ads")}
      />

      <section className="player-caption">
        <button
          type="button"
          className="player-caption__avatar"
          onClick={() => authorId && navigate(`/profile/${authorId}`)}
          disabled={!authorId}
        >
          {authorAvatar ? (
            <img src={authorAvatar} alt="" onError={(event) => handleStaticImageError(event, "default.png")} />
          ) : (
            <img src={staticImage("default.png")} alt="" onError={(event) => handleStaticImageError(event, "default.png")} />
          )}
        </button>
        <div>
          <button type="button" onClick={() => authorId && navigate(`/profile/${authorId}`)} disabled={!authorId}>
            @{username}
            {author?.verified || author?.roleName === "verified" ? (
              <img src={staticImage("verified.png")} alt="Verified" onError={(event) => handleStaticImageError(event, "verified.png")} />
            ) : null}
          </button>
          <p>{content || "Yenkasa update"}</p>
          <small>♪ {communityName} · {formatRelativeTime(post?.createdAt)}</small>
        </div>
      </section>

      {shareStatus ? <div className="player-share-status">{shareStatus}</div> : null}

      <YenkasaWebPlayerControls
        mediaRef={mediaRef}
        active={active}
        hasMedia={isVideo || isAudio}
        type={mediaKind}
      />
    </article>
  );
}

function AudioPanel({ mediaRef, source, post, username }) {
  const artwork = post?.artwork || post?.coverImage || post?.thumbnail || buildMediaUrl(post);

  return (
    <div className="player-card__audio-panel">
      <audio ref={mediaRef} src={source} preload="metadata" />
      {artwork ? (
        <img src={artwork} alt="" loading="lazy" />
      ) : (
        <div className="player-card__audio-fallback">
          <img src={staticImage("logo.png")} alt="" onError={(event) => handleStaticImageError(event, "logo.png")} />
        </div>
      )}
      <strong>{post?.title || `${username}'s audio`}</strong>
      <small>Original Sound - Yenkasa</small>
    </div>
  );
}

function readViewedPostIds(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function writeViewedPostIds(key, ids) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-250)));
  } catch {
    // Ignore storage failures in private browsing.
  }
}
