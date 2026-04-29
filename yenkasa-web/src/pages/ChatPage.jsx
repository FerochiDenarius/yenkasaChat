import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatSectionNav from "../components/chat/ChatSectionNav";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";
import useChat from "../hooks/useChat";
import { getRoomParticipant, getUserId } from "../utils/chat";
import "../styles/chatrooms.css";

export default function ChatPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [searchUsername, setSearchUsername] = useState("");
  const chat = useChat(roomId);

  const selectedRoom = useMemo(
    () => chat.rooms.find((room) => room?._id === roomId) || null,
    [chat.rooms, roomId]
  );

  async function handleCreateRoom(username) {
    const nextRoomId = await chat.createRoomByUsername(username);
    if (!nextRoomId) return;
    setSearchUsername("");
    navigate(`/chatrooms/${nextRoomId}`);
  }

  function handleSelectRoom(nextRoomId) {
    if (!nextRoomId) return;
    navigate(`/chatrooms/${nextRoomId}`);
  }

  function handleBack() {
    navigate("/chatrooms");
  }

  function handleViewContact() {
    const profileId =
      getUserId(chat.participant) ||
      getUserId(getRoomParticipant(selectedRoom, chat.currentUserId));
    if (profileId) {
      navigate(`/profile/${profileId}`);
      return;
    }
    chat.setChatNotice("View contact will be added next.");
  }

  function handleMuteNotifications() {
    chat.setChatNotice("Mute notifications will be added next.");
  }

  function handleClearChat() {
    chat.setChatNotice("Clear chat will be added next.");
  }

  function handlePickMedia(file, type) {
    chat.pickMedia(file, type);
  }

  function handlePickCustomBackground(file) {
    chat.setCustomBackgroundFile(file);
  }

  function handleSwipeStart(event, message) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    chat.setChatNotice("");
    chat.setSwipeState?.({
      id: message?._id,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
    });
  }

  function handleSwipeMove(event, message) {
    if (!chat.swipeState || chat.swipeState.id !== message?._id) return;
    const deltaX = event.clientX - chat.swipeState.startX;
    const deltaY = event.clientY - chat.swipeState.startY;
    if (Math.abs(deltaY) > 40 && Math.abs(deltaY) > Math.abs(deltaX)) {
      chat.setSwipeState?.(null);
      return;
    }
    chat.setSwipeState?.((current) =>
      current && current.id === message?._id
        ? { ...current, deltaX: Math.max(-72, Math.min(72, deltaX)) }
        : current
    );
  }

  function handleSwipeEnd(message) {
    if (!chat.swipeState || chat.swipeState.id !== message?._id) return;
    if (Math.abs(chat.swipeState.deltaX) > 52) {
      chat.showReply(message);
    }
    chat.setSwipeState?.(null);
  }

  return (
    <main className="chatrooms-page">
      <div className="chatrooms-workspace">
        {roomId ? (
          <ChatWindow
            roomId={roomId}
            participant={chat.participant}
            selectedRoom={selectedRoom}
            chatBackground={chat.chatBackground}
            threadStyle={chat.threadStyle}
            loadingThread={chat.loadingThread}
            bannerMessage={chat.threadError || chat.composerError || chat.chatNotice}
            groupedMessages={chat.groupedMessages}
            currentUser={chat.currentUser}
            currentUserId={chat.currentUserId}
            swipeState={chat.swipeState}
            onSwipeStart={handleSwipeStart}
            onSwipeMove={handleSwipeMove}
            onSwipeEnd={handleSwipeEnd}
            onSwipeCancel={() => chat.setSwipeState?.(null)}
            onReply={chat.showReply}
            draft={chat.draft}
            setDraft={chat.setDraft}
            onSend={chat.sendMessage}
            canSend={chat.canSend}
            sending={chat.sending}
            uploadingMedia={chat.uploadingMedia}
            recording={chat.recording}
            onToggleRecording={chat.toggleAudioRecording}
            selectedMedia={chat.selectedMedia}
            onClearSelectedMedia={chat.clearSelectedMedia}
            replyingTo={chat.replyingTo}
            onClearReply={chat.clearReplyingTo}
            onPickMedia={handlePickMedia}
            onPickCustomBackground={handlePickCustomBackground}
            onSelectBackground={chat.setBackgroundPreset}
            onBack={handleBack}
            onViewContact={handleViewContact}
            onMuteNotifications={handleMuteNotifications}
            onClearChat={handleClearChat}
            textareaRef={chat.composerTextareaRef}
            threadBodyRef={chat.threadBodyRef}
            threadEndRef={chat.threadEndRef}
          />
        ) : (
          <ChatSidebar
            rooms={chat.rooms}
            roomId={roomId}
            currentUserId={chat.currentUserId}
            loadingRooms={chat.loadingRooms}
            roomsError={chat.roomsError}
            searchUsername={searchUsername}
            setSearchUsername={setSearchUsername}
            creatingRoom={chat.creatingRoom}
            onCreateRoom={handleCreateRoom}
            onSelectRoom={handleSelectRoom}
          />
        )}
      </div>
      <ChatSectionNav />
    </main>
  );
}
