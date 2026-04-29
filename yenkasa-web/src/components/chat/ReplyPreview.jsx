import { renderReplyPreview, replyingToLabel } from "../../utils/chat";

export default function ReplyPreview({
  replyingTo,
  currentUserId,
  participant,
  onClear,
}) {
  if (!replyingTo) return null;

  return (
    <div className="chatroom-reply-preview">
      <span>
        <strong>{replyingToLabel(replyingTo, currentUserId, participant)}</strong>
        <small>{renderReplyPreview(replyingTo)}</small>
      </span>
      <button type="button" onClick={onClear} aria-label="Cancel reply">
        ×
      </button>
    </div>
  );
}
