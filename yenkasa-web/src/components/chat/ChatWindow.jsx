import { useRef, useState } from "react";
import ChatInput from "./ChatInput";
import ChatOptionsMenu from "./ChatOptionsMenu";
import ChatBackgroundPicker from "./ChatBackgroundPicker";
import MessageList from "./MessageList";
import { getUserImage } from "../../utils/chat";
import { handleDynamicImageError, staticImage } from "../../utils/images";

export default function ChatWindow({
  roomId,
  participant,
  selectedRoom,
  chatBackground,
  threadStyle,
  loadingThread,
  bannerMessage,
  groupedMessages,
  currentUser,
  currentUserId,
  swipeState,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel,
  onReply,
  draft,
  setDraft,
  onSend,
  canSend,
  sending,
  uploadingMedia,
  recording,
  onToggleRecording,
  selectedMedia,
  onClearSelectedMedia,
  replyingTo,
  onClearReply,
  onPickMedia,
  onPickCustomBackground,
  onSelectBackground,
  onBack,
  onViewContact,
  onOpenProfile,
  onMuteNotifications,
  onClearChat,
  textareaRef,
  threadBodyRef,
  threadEndRef,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const customBackgroundInputRef = useRef(null);

  function openBackgroundPicker() {
    setOptionsOpen(false);
    setBackgroundPickerOpen(true);
  }

  function handleViewContactClick() {
    setOptionsOpen(false);
    onViewContact();
  }

  function handleMuteNotificationsClick() {
    setOptionsOpen(false);
    onMuteNotifications();
  }

  function handleClearChatClick() {
    setOptionsOpen(false);
    onClearChat();
  }

  function handleCustomBackground(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onPickCustomBackground(file);
      setBackgroundPickerOpen(false);
    }
  }

  return (
    <section
      className={`chatroom-thread-panel chatroom-thread-panel--${chatBackground}`}
      style={threadStyle}
    >
      <header className="chatroom-hero-header">
        <button type="button" className="chatroom-circle-btn" onClick={onBack} aria-label="Back">
          <span className="icon-arrow-left" />
        </button>
        <button
          type="button"
          className="chatroom-hero-header__identity chatroom-hero-header__identity--button"
          onClick={onOpenProfile}
          aria-label={participant?.username ? `Open ${participant.username}'s profile` : "Open profile"}
        >
          <img
            src={getUserImage(participant) || staticImage("default.png")}
            onError={handleDynamicImageError}
            alt={participant?.username || "Yenkasa chat"}
          />
          <div>
            <strong>{participant?.username || "Your Chats"}</strong>
            <span>
              <i />
              {participant?.isOnline || participant?.online
                ? "Online"
                : selectedRoom
                ? "Available on Yenkasa"
                : "Select a room to start"}
            </span>
          </div>
        </button>
        <div className="chatroom-hero-header__actions">
          <button type="button" className="chatroom-circle-btn" aria-label="Video call">
            <span className="icon-video-camera" />
          </button>
          <button type="button" className="chatroom-circle-btn" aria-label="Voice call">
            <span className="icon-phone" />
          </button>
          <div className="chatroom-options-anchor">
            <button
              type="button"
              className="chatroom-circle-btn"
              aria-label="More"
              onClick={() => {
                setOptionsOpen((open) => !open);
                setBackgroundPickerOpen(false);
              }}
            >
              <span className="icon-dots-vertical" />
            </button>
            <ChatOptionsMenu
              open={optionsOpen}
              onOpenBackground={openBackgroundPicker}
              onViewContact={handleViewContactClick}
              onMuteNotifications={handleMuteNotificationsClick}
              onClearChat={handleClearChatClick}
            />
          </div>
        </div>
      </header>

      <ChatBackgroundPicker
        open={backgroundPickerOpen}
        activeBackground={chatBackground}
        onSelectPreset={(key) => {
          onSelectBackground(key);
          setBackgroundPickerOpen(false);
        }}
        onSelectCustomBackground={() => customBackgroundInputRef.current?.click()}
      />

      {bannerMessage ? <div className="error-banner">{bannerMessage}</div> : null}

      <section className="chatroom-thread-body" ref={threadBodyRef}>
        {loadingThread ? (
          <div className="chatrooms-status-card chatrooms-status-card--center">Loading chat...</div>
        ) : null}

        {!loadingThread && roomId && !groupedMessages.length ? (
          <div className="chatrooms-status-card chatrooms-status-card--center">
            No messages yet. Send the first message.
          </div>
        ) : null}

        {!loadingThread ? (
          <MessageList
            groupedMessages={groupedMessages}
            currentUser={currentUser}
            swipeState={swipeState}
            onSwipeStart={onSwipeStart}
            onSwipeMove={onSwipeMove}
            onSwipeEnd={onSwipeEnd}
            onSwipeCancel={onSwipeCancel}
            onReply={onReply}
          />
        ) : null}
        <div ref={threadEndRef} />
      </section>

      <ChatInput
        draft={draft}
        setDraft={setDraft}
        onSend={onSend}
        canSend={canSend}
        sending={sending}
        uploadingMedia={uploadingMedia}
        roomId={roomId}
        recording={recording}
        onToggleRecording={onToggleRecording}
        selectedMedia={selectedMedia}
        onClearSelectedMedia={onClearSelectedMedia}
        replyingTo={replyingTo}
        currentUserId={currentUserId}
        participant={participant}
        onClearReply={onClearReply}
        onPickMedia={onPickMedia}
        textareaRef={textareaRef}
      />
      <input
        ref={customBackgroundInputRef}
        className="chatroom-hidden-input"
        type="file"
        accept="image/*"
        onChange={handleCustomBackground}
      />
    </section>
  );
}
