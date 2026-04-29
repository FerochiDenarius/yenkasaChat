export default function ChatOptionsMenu({
  open,
  onOpenBackground,
  onViewContact,
  onMuteNotifications,
  onClearChat,
}) {
  if (!open) return null;

  return (
    <div className="chatroom-options-menu">
      <button type="button" onClick={onOpenBackground}>
        Change chat background
      </button>
      <button type="button" onClick={onViewContact}>
        View contact
      </button>
      <button type="button" onClick={onMuteNotifications}>
        Mute notifications
      </button>
      <button type="button" onClick={onClearChat}>
        Clear chat
      </button>
    </div>
  );
}
