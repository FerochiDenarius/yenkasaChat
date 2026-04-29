export default function ChatMessageMenu({
  open,
  isOwnMessage,
  canEdit,
  onReply,
  onEdit,
  onDelete,
}) {
  if (!open) return null;

  return (
    <div className="chatroom-message-menu">
      <button type="button" onClick={onReply}>
        Reply
      </button>
      {isOwnMessage && canEdit ? (
        <button type="button" onClick={onEdit}>
          Edit
        </button>
      ) : null}
      {isOwnMessage ? (
        <button type="button" className="chatroom-message-menu__danger" onClick={onDelete}>
          Delete
        </button>
      ) : null}
    </div>
  );
}
