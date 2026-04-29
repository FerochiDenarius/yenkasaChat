import MessageItem from "./MessageItem";

export default function MessageList({
  groupedMessages,
  currentUser,
  swipeState,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel,
  onReply,
}) {
  return groupedMessages.map((entry) => (
    <MessageItem
      key={entry.key}
      entry={entry}
      currentUser={currentUser}
      swipeState={swipeState}
      onSwipeStart={onSwipeStart}
      onSwipeMove={onSwipeMove}
      onSwipeEnd={onSwipeEnd}
      onSwipeCancel={onSwipeCancel}
      onReply={onReply}
    />
  ));
}
