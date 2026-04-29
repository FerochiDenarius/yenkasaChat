import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createChatRoom,
  getChatRoom,
  getChatRoomReceiver,
  getChatRooms,
} from "../api/chatrooms";
import {
  getRoomMessages,
  markRoomAsRead,
  sendRoomMessage,
  uploadRoomMedia,
} from "../api/messages";
import ChatSectionNav from "../components/chat/ChatSectionNav";
import { handleDynamicImageError, staticImage } from "../utils/images";
import { getStoredUser } from "../utils/storage";
import "../styles/chatrooms.css";

const CHAT_BACKGROUND_PRESETS = [
  { key: "default", label: "Default" },
  { key: "cream", label: "Cream" },
  { key: "savanna", label: "Savanna" },
  { key: "mint", label: "Mint" },
  { key: "ocean", label: "Ocean" },
  { key: "sunset", label: "Sunset" },
  { key: "graphite", label: "Graphite" },
];

export default function ChatRooms() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const threadEndRef = useRef(null);
  const threadBodyRef = useRef(null);
  const roomsRef = useRef([]);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const customBackgroundInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const lastScrolledRoomRef = useRef("");
  const previousMessageCountRef = useRef(0);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [participant, setParticipant] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [chatBackground, setChatBackground] = useState(() =>
    window.localStorage.getItem("yenkasa_chat_background") || "default"
  );
  const [customBackground, setCustomBackground] = useState(() =>
    window.localStorage.getItem("yenkasa_chat_custom_background") || ""
  );
  const [swipeState, setSwipeState] = useState(null);
  const currentUser = useMemo(() => getStoredUser() || {}, []);
  const currentUserId = getUserId(currentUser);
  const canSend = Boolean(draft.trim() || selectedMedia);
  const threadStyle =
    chatBackground === "custom" && customBackground
      ? { "--chat-custom-background": `url("${customBackground}")` }
      : undefined;

  const selectedRoom = useMemo(
    () => rooms.find((room) => room?._id === roomId) || null,
    [rooms, roomId]
  );

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastLabel = "";

    for (const message of messages.filter(Boolean)) {
      const label = formatDateChip(message?.timestamp || message?.createdAt);
      if (label !== lastLabel) {
        groups.push({ type: "divider", label, key: `divider-${label}` });
        lastLabel = label;
      }
      groups.push({
        type: "message",
        message,
        key: message?._id || `${label}-${groups.length}`,
      });
    }

    return groups;
  }, [messages]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    return () => {
      if (selectedMedia?.previewUrl) {
        window.URL.revokeObjectURL(selectedMedia.previewUrl);
      }
    };
  }, [selectedMedia]);

  useEffect(() => {
    let active = true;
    let pollId;

    async function loadRooms(showLoader = true) {
      if (showLoader) {
        setLoadingRooms(true);
      }
      try {
        const data = await getChatRooms();
        if (!active) return;
        const nextRooms = Array.isArray(data) ? data : [];
        setRooms(normalizeChatRooms(nextRooms, currentUserId));
      } catch (requestError) {
        if (!active) return;
        setRoomsError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Failed to load chat rooms."
        );
      } finally {
        if (active && showLoader) setLoadingRooms(false);
      }
    }

    setRoomsError("");
    loadRooms();
    pollId = window.setInterval(() => {
      loadRooms(false);
    }, 8000);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [currentUserId]);

  useEffect(() => {
    let active = true;
    let pollId;

    async function loadThread(showLoader = true) {
      if (!roomId) {
        setParticipant(null);
        setMessages([]);
        return;
      }

      if (showLoader) {
        setLoadingThread(true);
      }

      try {
        const [roomDetails, receiverDetails, roomMessages] = await Promise.all([
          getChatRoom(roomId).catch(() => null),
          getChatRoomReceiver(roomId).catch(() => null),
          getRoomMessages(roomId),
        ]);

        if (!active) return;

        setParticipant(
          receiverDetails?.receiver ||
            roomDetails?.participant ||
            getRoomParticipant(roomDetails, currentUserId) ||
            getRoomParticipant(
              roomsRef.current.find((room) => room?._id === roomId),
              currentUserId
            ) ||
            null
        );
        setMessages(Array.isArray(roomMessages) ? roomMessages : []);
        setRooms((prev) =>
          prev.map((room) =>
            room._id === roomId
              ? { ...room, unreadCount: 0 }
              : room
          )
        );
        await markRoomAsRead(roomId).catch(() => null);
      } catch (requestError) {
        if (!active) return;
        setThreadError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Failed to load this chat."
        );
      } finally {
        if (active && showLoader) setLoadingThread(false);
      }
    }

    setThreadError("");
    loadThread();
    pollId = window.setInterval(() => {
      loadThread(false);
    }, 4000);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [currentUserId, roomId]);

  useEffect(() => {
    const isNewRoom = lastScrolledRoomRef.current !== String(roomId || "");
    const previousCount = previousMessageCountRef.current;
    const nextCount = groupedMessages.length;

    if (isNewRoom) {
      scrollThreadToBottom("auto");
      lastScrolledRoomRef.current = String(roomId || "");
    } else if (nextCount > previousCount && isNearThreadBottom()) {
      scrollThreadToBottom("smooth");
    }

    previousMessageCountRef.current = nextCount;
  }, [groupedMessages.length, roomId]);

  function scrollThreadToBottom(behavior = "smooth") {
    window.requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ block: "end", behavior });
    });
  }

  function isNearThreadBottom() {
    const element = threadBodyRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 160;
  }

  async function handleCreateRoom(event) {
    event.preventDefault();
    const username = searchUsername.trim();
    if (!username || creatingRoom) return;

    setCreatingRoom(true);
    setRoomsError("");

    try {
      const response = await createChatRoom(username);
      if (!response?.success || !response?.roomId) {
        setRoomsError(response?.message || "Could not create chat room.");
        return;
      }

      const nextRoom = {
        _id: response.roomId,
        participants: response.participant ? [response.participant] : [],
        lastMessage: null,
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
      };

      setRooms((prev) => {
        const exists = prev.some((room) => room._id === nextRoom._id);
        return exists
          ? prev
          : normalizeChatRooms([nextRoom, ...prev], currentUserId);
      });
      setSearchUsername("");
      navigate(`/chatrooms/${response.roomId}`);
    } catch (requestError) {
      setRoomsError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Unable to start that chat."
      );
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!roomId || !canSend || sending || uploadingMedia) return;

    setSending(true);
    setUploadingMedia(Boolean(selectedMedia));
    setComposerError("");
    try {
      const payload = { roomId };
      if (text) payload.text = text;
      if (replyingTo?._id) payload.repliedTo = replyingTo._id;

      if (selectedMedia?.file) {
        const uploadResult = await uploadRoomMedia(selectedMedia.file, selectedMedia.type);
        if (!uploadResult?.url || !uploadResult?.messageKey) {
          throw new Error("Chat media upload did not return a usable URL.");
        }
        payload[uploadResult.messageKey] = uploadResult.url;
      }

      const created = await sendRoomMessage(payload);
      setMessages((prev) => [...prev, created]);
      setDraft("");
      clearReplyingTo();
      clearSelectedMedia();
      setAttachOpen(false);
      setRooms((prev) =>
        prev.map((room) =>
          room._id === roomId
            ? {
                ...room,
                lastMessage: created,
                lastMessageTime:
                  created?.timestamp || created?.createdAt || new Date().toISOString(),
              }
            : room
        )
      );
      scrollThreadToBottom("smooth");
    } catch (requestError) {
      setComposerError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to send message."
      );
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  }

  function handleMediaPick(event, forcedType) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const type = forcedType || inferUploadType(file);
    if (selectedMedia?.previewUrl) {
      window.URL.revokeObjectURL(selectedMedia.previewUrl);
    }

    setSelectedMedia({
      file,
      type,
      name: file.name || `${type} upload`,
      previewUrl: window.URL.createObjectURL(file),
    });
    setAttachOpen(false);
  }

  function clearSelectedMedia() {
    setSelectedMedia((current) => {
      if (current?.previewUrl) {
        window.URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
  }

  function showReply(message) {
    setReplyingTo(message);
    setAttachOpen(false);
    window.requestAnimationFrame(() => {
      document.querySelector(".chatroom-composer textarea")?.focus();
    });
  }

  function clearReplyingTo() {
    setReplyingTo(null);
  }

  async function toggleAudioRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setComposerError("Audio recording is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `audio_${Date.now()}.webm`, {
          type: blob.type,
        });
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        if (blob.size) {
          if (selectedMedia?.previewUrl) {
            window.URL.revokeObjectURL(selectedMedia.previewUrl);
          }
          setSelectedMedia({
            file,
            type: "audio",
            name: "Voice message",
            previewUrl: window.URL.createObjectURL(blob),
          });
        }
      };

      recorder.start();
      setRecording(true);
      setAttachOpen(false);
      setComposerError("");
    } catch (requestError) {
      setRecording(false);
      setComposerError(
        requestError?.message ||
          "Microphone permission is needed before sending an audio message."
      );
    }
  }

  function handleBackgroundSelect(nextBackground) {
    setChatBackground(nextBackground);
    window.localStorage.setItem("yenkasa_chat_background", nextBackground);
    setBackgroundPickerOpen(false);
  }

  function handleCustomBackground(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setCustomBackground(result);
      setChatBackground("custom");
      window.localStorage.setItem("yenkasa_chat_custom_background", result);
      window.localStorage.setItem("yenkasa_chat_background", "custom");
      setBackgroundPickerOpen(false);
    };
    reader.readAsDataURL(file);
  }

  function startSwipe(event, message) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    setSwipeState({
      id: message?._id,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
    });
  }

  function moveSwipe(event, message) {
    if (!swipeState || swipeState.id !== message?._id) return;
    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;
    if (Math.abs(deltaY) > 40 && Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeState(null);
      return;
    }
    setSwipeState((current) =>
      current && current.id === message?._id
        ? { ...current, deltaX: Math.max(-72, Math.min(72, deltaX)) }
        : current
    );
  }

  function endSwipe(message) {
    if (!swipeState || swipeState.id !== message?._id) return;
    if (Math.abs(swipeState.deltaX) > 52) {
      showReply(message);
    }
    setSwipeState(null);
  }

  return (
    <main className="chatrooms-page">
      <div className="chatrooms-workspace">
        {roomId ? (
          <section
            className={`chatroom-thread-panel chatroom-thread-panel--${chatBackground}`}
            style={threadStyle}
          >
            <header className="chatroom-hero-header">
              <button
                type="button"
                className="chatroom-circle-btn"
                onClick={() => navigate("/chatrooms")}
                aria-label="Back"
              >
                <span className="icon-arrow-left" />
              </button>
              <div className="chatroom-hero-header__identity">
                <img
                  src={
                    getUserImage(participant) || staticImage("default.png")
                  }
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
              </div>
              <div className="chatroom-hero-header__actions">
                <button type="button" className="chatroom-circle-btn" aria-label="Video call">
                  <span className="icon-video-camera" />
                </button>
                <button type="button" className="chatroom-circle-btn" aria-label="Voice call">
                  <span className="icon-phone" />
                </button>
                <button
                  type="button"
                  className="chatroom-circle-btn"
                  aria-label="More"
                  onClick={() => setBackgroundPickerOpen((open) => !open)}
                >
                  <span className="icon-dots-vertical" />
                </button>
              </div>
            </header>

            {backgroundPickerOpen ? (
              <section className="chatroom-background-picker">
                <strong>Chat background</strong>
                <div>
                  {CHAT_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className={`chatroom-bg-swatch chatroom-bg-swatch--${preset.key}${
                        chatBackground === preset.key ? " is-active" : ""
                      }`}
                      onClick={() => handleBackgroundSelect(preset.key)}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`chatroom-bg-swatch chatroom-bg-swatch--custom${
                      chatBackground === "custom" ? " is-active" : ""
                    }`}
                    onClick={() => customBackgroundInputRef.current?.click()}
                  >
                    Custom
                  </button>
                </div>
              </section>
            ) : null}

            {threadError || composerError ? (
              <div className="error-banner">{threadError || composerError}</div>
            ) : null}

            <section className="chatroom-thread-body" ref={threadBodyRef}>
              {loadingThread ? (
                <div className="chatrooms-status-card chatrooms-status-card--center">
                  Loading chat...
                </div>
              ) : null}

              {!loadingThread && roomId && !groupedMessages.length ? (
                <div className="chatrooms-status-card chatrooms-status-card--center">
                  No messages yet. Send the first message.
                </div>
              ) : null}

              {!loadingThread &&
                groupedMessages.map((entry) => {
                  if (entry.type === "divider") {
                    return (
                      <div key={entry.key} className="chatroom-date-chip">
                        <span>{entry.label}</span>
                      </div>
                    );
                  }

                  const message = entry.message;
                  const ownMessage = isOwnMessage(message, currentUser);
                  const bubbleClass = ownMessage
                    ? "chatroom-message chatroom-message--own"
                    : "chatroom-message";
                  const swipeDelta =
                    swipeState?.id === message?._id ? swipeState.deltaX : 0;

                  return (
                    <article
                      key={entry.key}
                      className={`${bubbleClass}${Math.abs(swipeDelta) > 16 ? " is-swiping" : ""}`}
                      style={
                        swipeDelta
                          ? { transform: `translateX(${swipeDelta}px)` }
                          : undefined
                      }
                      onPointerDown={(event) => startSwipe(event, message)}
                      onPointerMove={(event) => moveSwipe(event, message)}
                      onPointerUp={() => endSwipe(message)}
                      onPointerCancel={() => setSwipeState(null)}
                    >
                      {Math.abs(swipeDelta) > 16 ? (
                        <span className="chatroom-message__reply-cue">↩</span>
                      ) : null}
                      {renderMessageContent(message)}
                      <button
                        type="button"
                        className="chatroom-message__reply-btn"
                        onClick={() => showReply(message)}
                      >
                        Reply
                      </button>
                      <span className="chatroom-message__time">
                        {formatClock(message?.timestamp || message?.createdAt)}
                        {ownMessage ? " ✓✓" : ""}
                      </span>
                    </article>
                  );
                })}
              <div ref={threadEndRef} />
            </section>

            <form className="chatroom-composer" onSubmit={handleSend}>
              {replyingTo ? (
                <div className="chatroom-reply-preview">
                  <span>
                    <strong>{replyingToLabel(replyingTo, currentUserId, participant)}</strong>
                    <small>{renderReplyPreview(replyingTo)}</small>
                  </span>
                  <button type="button" onClick={clearReplyingTo} aria-label="Cancel reply">
                    ×
                  </button>
                </div>
              ) : null}

              {selectedMedia ? (
                <div className="chatroom-media-preview">
                  {selectedMedia.type === "image" ? (
                    <img src={selectedMedia.previewUrl} alt={selectedMedia.name} />
                  ) : selectedMedia.type === "video" ? (
                    <video src={selectedMedia.previewUrl} muted playsInline />
                  ) : selectedMedia.type === "audio" ? (
                    <audio src={selectedMedia.previewUrl} controls />
                  ) : (
                    <span className="chatroom-media-preview__file">📄</span>
                  )}
                  <span>
                    <strong>{selectedMediaLabel(selectedMedia)}</strong>
                    <small>{uploadingMedia ? "Uploading..." : "Ready to send"}</small>
                  </span>
                  <button type="button" onClick={clearSelectedMedia} aria-label="Remove media">
                    ×
                  </button>
                </div>
              ) : null}

              {attachOpen ? (
                <div className="chatroom-attach-menu">
                  <button type="button" onClick={() => imageInputRef.current?.click()}>
                    Photo
                  </button>
                  <button type="button" onClick={() => videoInputRef.current?.click()}>
                    Video
                  </button>
                  <button type="button" onClick={() => audioInputRef.current?.click()}>
                    Audio
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    File
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="chatroom-composer__addon"
                aria-label="More actions"
                onClick={() => setAttachOpen((open) => !open)}
              >
                <span className="icon-plus" />
              </button>
              <textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (attachOpen) setAttachOpen(false);
                }}
                rows={1}
                placeholder="Type a message..."
              />
              {!canSend ? (
                <button
                  type="button"
                  className={`chatroom-composer__mic${recording ? " is-recording" : ""}`}
                  onClick={toggleAudioRecording}
                  aria-label={recording ? "Stop recording" : "Record audio"}
                >
                  <span>{recording ? "■" : "●"}</span>
                </button>
              ) : null}
              <button
                type="submit"
                className="chatroom-composer__send"
                disabled={!canSend || sending || uploadingMedia || !roomId}
                aria-label="Send message"
              >
                <span className={sending || uploadingMedia ? "icon-loader" : "icon-send"} />
              </button>
              <input
                ref={imageInputRef}
                className="chatroom-hidden-input"
                type="file"
                accept="image/*"
                onChange={(event) => handleMediaPick(event, "image")}
              />
              <input
                ref={videoInputRef}
                className="chatroom-hidden-input"
                type="file"
                accept="video/*"
                onChange={(event) => handleMediaPick(event, "video")}
              />
              <input
                ref={audioInputRef}
                className="chatroom-hidden-input"
                type="file"
                accept="audio/*"
                onChange={(event) => handleMediaPick(event, "audio")}
              />
              <input
                ref={fileInputRef}
                className="chatroom-hidden-input"
                type="file"
                onChange={(event) => handleMediaPick(event, "file")}
              />
              <input
                ref={customBackgroundInputRef}
                className="chatroom-hidden-input"
                type="file"
                accept="image/*"
                onChange={handleCustomBackground}
              />
            </form>
          </section>
        ) : (
          <aside className="chatrooms-sidebar chatrooms-sidebar--standalone">
            <header className="chatrooms-sidebar__header">
              <div>
                <strong>Your Chat Rooms</strong>
                <span>Find people by username and continue your chats.</span>
              </div>
            </header>

            <form className="chatrooms-create-form" onSubmit={handleCreateRoom}>
              <input
                value={searchUsername}
                onChange={(event) => setSearchUsername(event.target.value)}
                placeholder="Enter username to chat"
              />
              <button type="submit" disabled={!searchUsername.trim() || creatingRoom}>
                {creatingRoom ? "Opening..." : "Create Chat Room"}
              </button>
            </form>

            <section className="chatrooms-sidebar__list">
              {roomsError ? <div className="error-banner">{roomsError}</div> : null}

              {loadingRooms ? (
                <div className="chatrooms-status-card">Loading chat rooms...</div>
              ) : null}

              {!loadingRooms && !rooms.length ? (
                <div className="chatrooms-status-card">
                  No chat rooms yet. Search for a username to start chatting.
                </div>
              ) : null}

              {!loadingRooms &&
                rooms.map((room) => {
                  const itemParticipant = getRoomParticipant(room, currentUserId);
                  const isActive = room?._id === roomId;

                  return (
                    <button
                      key={room?._id}
                      type="button"
                      className={`chatrooms-room${isActive ? " is-active" : ""}`}
                      onClick={() => navigate(`/chatrooms/${room._id}`)}
                    >
                      <img
                        className="chatrooms-room__avatar"
                        src={
                          getUserImage(itemParticipant) || staticImage("default.png")
                        }
                        onError={handleDynamicImageError}
                        alt={itemParticipant?.username || "Chat room"}
                      />
                      <div className="chatrooms-room__copy">
                        <span className="chatrooms-room__time">
                          {formatRoomTimestamp(room?.lastMessageTime)}
                        </span>
                        <strong>{itemParticipant?.username || "Unknown user"}</strong>
                        <small>{renderPreview(room?.lastMessage)}</small>
                      </div>
                      {room?.unreadCount ? (
                        <span className="chatrooms-room__unread">{room.unreadCount}</span>
                      ) : null}
                    </button>
                  );
                })}
            </section>
          </aside>
        )}
      </div>
      <ChatSectionNav />
    </main>
  );
}

function getUserId(user) {
  return String(user?._id || user?.id || user?.userId || user?.uid || "");
}

function inferUploadType(file) {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("video/")) return "video";
  if (file?.type?.startsWith("audio/")) return "audio";
  return "file";
}

function selectedMediaLabel(media) {
  if (!media) return "";
  if (media.type === "image") return "Photo ready";
  if (media.type === "video") return "Video ready";
  if (media.type === "audio") return "Audio ready";
  return media.name || "File ready";
}

function replyingToLabel(message, currentUserId, participant) {
  const senderId =
    message?.senderId?._id ||
    message?.senderId?.id ||
    message?.senderId ||
    message?.sender?._id ||
    message?.sender?.id ||
    "";

  if (String(senderId) === String(currentUserId)) return "Replying to you";
  const name =
    message?.sender?.username ||
    message?.senderId?.username ||
    participant?.username ||
    "this message";
  return `Replying to ${name}`;
}

function getUserImage(user) {
  return (
    user?.displayImage ||
    user?.profileImage ||
    user?.profileImageUrl ||
    user?.profilePicUrl ||
    user?.avatar ||
    user?.photoUrl ||
    ""
  );
}

function getRoomParticipant(room, currentUserId) {
  const participants = Array.isArray(room?.participants)
    ? room.participants.filter(Boolean)
    : [];
  const seen = new Set();
  const uniqueParticipants = participants.filter((participant) => {
    const id = getUserId(participant);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const others = uniqueParticipants.filter(
    (participant) => getUserId(participant) !== String(currentUserId || "")
  );

  return (
    others[0] ||
    room?.participant ||
    room?.receiver ||
    room?.user ||
    uniqueParticipants[0] ||
    null
  );
}

function normalizeChatRooms(rooms, currentUserId) {
  const uniqueByParticipant = new Map();

  for (const room of rooms.filter(Boolean)) {
    const participant = getRoomParticipant(room, currentUserId);
    const key = getUserId(participant) || room?._id;
    if (!key || uniqueByParticipant.has(key)) continue;
    uniqueByParticipant.set(key, room);
  }

  return Array.from(uniqueByParticipant.values()).sort((left, right) => {
    const leftTime = getRoomActivityTime(left);
    const rightTime = getRoomActivityTime(right);
    if (rightTime !== leftTime) return rightTime - leftTime;
    return Number(right?.unreadCount || 0) - Number(left?.unreadCount || 0);
  });
}

function getRoomActivityTime(room) {
  const value =
    room?.lastMessageTime ||
    room?.lastMessage?.timestamp ||
    room?.lastMessage?.createdAt ||
    room?.createdAt;
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isOwnMessage(message, currentUser) {
  const currentUserId = getUserId(currentUser);
  const senderId =
    message?.senderId?._id ||
    message?.senderId?.id ||
    message?.senderId ||
    message?.sender?._id ||
    message?.sender?.id ||
    message?.sender ||
    message?.userId?._id ||
    message?.userId?.id ||
    message?.userId ||
    "";
  return String(senderId) === String(currentUserId);
}

function renderMessageContent(message) {
  return (
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
        <a
          className="chatroom-message__resource"
          href={message.fileUrl}
          target="_blank"
          rel="noreferrer"
        >
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
  );
}

function renderPreview(message) {
  if (!message) return "No messages yet";
  if (message?.repliedTo && message?.text) return `↩ ${message.text}`;
  if (message?.text) return message.text;
  if (message?.imageUrl) return "📷 Photo";
  if (message?.audioUrl) return "🎤 Audio";
  if (message?.videoUrl) return "🎬 Video";
  if (message?.fileUrl) return "📄 File";
  if (message?.location) return "📍 Location";
  if (message?.contactInfo) return "👤 Contact";
  return "Unsupported message";
}

function renderReplyPreview(message) {
  if (!message) return "Message";
  if (message?.text) return message.text;
  if (message?.imageUrl) return "📷 Photo";
  if (message?.audioUrl) return "🎤 Audio";
  if (message?.videoUrl) return "🎬 Video";
  if (message?.fileUrl) return "📄 File";
  if (message?.location) return "📍 Location";
  if (message?.contactInfo) return "👤 Contact";
  return "Message";
}

function extractFileLabel(url) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "Attachment";
  } catch {
    return "Attachment";
  }
}

function formatClock(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateChip(value) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRoomTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
