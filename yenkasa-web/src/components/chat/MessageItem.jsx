import {
  extractFileLabel,
  formatClock,
  isOwnMessage,
  renderReplyPreview,
} from "../../utils/chat";

export default function MessageItem({
  entry,
  currentUser,
  swipeState,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel,
  onReply,
}) {
  if (entry.type === "divider") {
    return (
      <div className="chatroom-date-chip">
        <span>{entry.label}</span>
      </div>
    );
  }

  const message = entry.message;
  const messageId = message?._id || message?.id || "";
  const ownMessage = isOwnMessage(message, currentUser);
  const bubbleClass = ownMessage ? "chatroom-message chatroom-message--own" : "chatroom-message";
  const swipeDelta = swipeState?.id === messageId ? swipeState.deltaX : 0;

  return (
    <article
      className={`${bubbleClass}${Math.abs(swipeDelta) > 16 ? " is-swiping" : ""}`}
      style={swipeDelta ? { transform: `translateX(${swipeDelta}px)` } : undefined}
      onPointerDown={(event) => onSwipeStart(event, message)}
      onPointerMove={(event) => onSwipeMove(event, message)}
      onPointerUp={() => onSwipeEnd(message)}
      onPointerCancel={onSwipeCancel}
    >
      {Math.abs(swipeDelta) > 16 ? (
        <span className="chatroom-message__reply-cue">↩</span>
      ) : null}
      <div className="chatroom-message__bubble">
        {message?.repliedTo ? (
          <div className="chatroom-message__reply">
            <strong>
              {message?.repliedTo?.sender?.username ||
                message?.repliedTo?.senderId?.username ||
                "Reply"}
            </strong>
            <span>{renderReplyPreview(message.repliedTo)}</span>
          </div>
        ) : null}

        {message?.imageUrl ? (
          <div className="chatroom-message__media-block">
            <img src={message.imageUrl} alt="Sent media" />
          </div>
        ) : null}

        {message?.videoUrl ? (
          <div className="chatroom-message__media-block">
            <video src={message.videoUrl} controls playsInline preload="metadata" />
          </div>
        ) : null}

        {message?.audioUrl ? (
          <div className="chatroom-message__audio-block">
            <audio src={message.audioUrl} controls preload="metadata" />
          </div>
        ) : null}

        {message?.fileUrl ? (
          <a className="chatroom-message__resource" href={message.fileUrl} target="_blank" rel="noreferrer">
            <span className="chatroom-message__resource-icon">📄</span>
            <span>
              <strong>{extractFileLabel(message.fileUrl)}</strong>
              <small>Open file</small>
            </span>
          </a>
        ) : null}

        {message?.location?.latitude != null && message?.location?.longitude != null ? (
          <a
            className="chatroom-message__resource"
            href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="chatroom-message__resource-icon">📍</span>
            <span>
              <strong>Shared location</strong>
              <small>
                {message.location.latitude.toFixed(4)}, {message.location.longitude.toFixed(4)}
              </small>
            </span>
          </a>
        ) : null}

        {message?.contactInfo ? (
          <div className="chatroom-message__resource">
            <span className="chatroom-message__resource-icon">👤</span>
            <span>
              <strong>Shared contact</strong>
              <small>{message.contactInfo}</small>
            </span>
          </div>
        ) : null}

        {message?.text ? <div className="chatroom-message__text">{message.text}</div> : null}

        {!message?.text &&
        !message?.imageUrl &&
        !message?.videoUrl &&
        !message?.audioUrl &&
        !message?.fileUrl &&
        !message?.location &&
        !message?.contactInfo ? (
          <div className="chatroom-message__text">Unsupported message</div>
        ) : null}
      </div>

      <button
        type="button"
        className="chatroom-message__reply-btn"
        onClick={() => onReply(message)}
      >
        Reply
      </button>
      <span className="chatroom-message__time">
        {formatClock(message?.timestamp || message?.createdAt)}
        {ownMessage ? " ✓✓" : ""}
      </span>
    </article>
  );
}
