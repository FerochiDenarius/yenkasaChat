import { formatNumber, getPostCommentCount } from "../../utils/format";

export default function YenkasaWebPlayerActions({
  post,
  liked,
  saved,
  busy,
  sharing,
  onLike,
  onComment,
  onShare,
  onSave,
  onCreateSponsoredAd,
}) {
  const likeCount = Number(post?.likeCount || 0);
  const commentCount = getPostCommentCount(post);
  const shareCount = Number(post?.shareCount || 0);
  const reward = Number(post?.rewardYKC || post?.rewardAmount || 2);

  return (
    <aside className="player-actions" aria-label="Post actions">
      <ActionButton
        icon={liked ? "♥" : "♡"}
        count={likeCount}
        label="Like"
        active={liked}
        disabled={busy}
        onClick={onLike}
      />
      <ActionButton icon="💬" count={commentCount} label="Comment" onClick={onComment} />
      <ActionButton
        icon="➤"
        count={shareCount}
        label={sharing ? "Sharing" : "Share"}
        disabled={sharing}
        onClick={onShare}
      />
      <ActionButton icon={saved ? "▰" : "▱"} count={post?.saveCount || post?.savedCount || 0} label="Save" active={saved} onClick={onSave} />
      <button type="button" className="player-action player-action--reward" onClick={onCreateSponsoredAd}>
        <span className="player-action__icon">◎</span>
        <strong>+{formatNumber(reward)} YKC</strong>
        <small>Reward</small>
      </button>
    </aside>
  );
}

function ActionButton({ icon, count, label, active = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className={`player-action${active ? " is-active" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="player-action__icon">{icon}</span>
      <strong>{formatNumber(count)}</strong>
      <small>{label}</small>
    </button>
  );
}
