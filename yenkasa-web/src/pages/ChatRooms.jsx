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
} from "../api/messages";
import { staticImage } from "../utils/images";
import { getStoredUser } from "../utils/storage";
import "../styles/chatrooms.css";

const CURRENT_USER = getStoredUser() || {};

export default function ChatRooms() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const threadEndRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [participant, setParticipant] = useState(null);
  const [messages, setMessages] = useState([]);

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
        setRooms(nextRooms);

        if (!roomId && nextRooms.length) {
          navigate(`/chatrooms/${nextRooms[0]._id}`, { replace: true });
        }
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Failed to load chat rooms."
        );
      } finally {
        if (active && showLoader) setLoadingRooms(false);
      }
    }

    setError("");
    loadRooms();
    pollId = window.setInterval(() => {
      loadRooms(false);
    }, 8000);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [navigate, roomId]);

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
            rooms.find((room) => room?._id === roomId)?.participants?.[0] ||
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
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Failed to load this chat."
        );
      } finally {
        if (active && showLoader) setLoadingThread(false);
      }
    }

    setError("");
    loadThread();
    pollId = window.setInterval(() => {
      loadThread(false);
    }, 4000);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [roomId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [groupedMessages.length, roomId]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastLabel = "";

    for (const message of messages.filter(Boolean)) {
      const label = formatDateChip(message?.timestamp || message?.createdAt);
      if (label !== lastLabel) {
        groups.push({ type: "divider", label, key: `divider-${label}` });
        lastLabel = label;
      }
      groups.push({ type: "message", message, key: message?._id || `${label}-${groups.length}` });
    }

    return groups;
  }, [messages]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room?._id === roomId) || null,
    [rooms, roomId]
  );

  async function handleCreateRoom(event) {
    event.preventDefault();
    const username = searchUsername.trim();
    if (!username || creatingRoom) return;

    setCreatingRoom(true);
    setError("");

    try {
      const response = await createChatRoom(username);
      if (!response?.success || !response?.roomId) {
        setError(response?.message || "Could not create chat room.");
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
        return exists ? prev : [nextRoom, ...prev];
      });
      setSearchUsername("");
      navigate(`/chatrooms/${response.roomId}`);
    } catch (requestError) {
      setError(
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
    if (!roomId || !text || sending) return;

    setSending(true);
    setError("");
    try {
      const created = await sendRoomMessage({ roomId, text });
      setMessages((prev) => [...prev, created]);
      setDraft("");
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
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="chatrooms-page">
      <div className="chatrooms-workspace">
        <section className="chatroom-thread-panel">
          <header className="chatroom-hero-header">
            <button
              type="button"
              className="chatroom-circle-btn"
              onClick={() => navigate("/")}
              aria-label="Back"
            >
              <span className="icon-arrow-left" />
            </button>
            <div className="chatroom-hero-header__identity">
              <img
                src={
                  participant?.profileImage ||
                  participant?.avatar ||
                  staticImage("yenkasa_web_assets/yenkasa_logo.png")
                }
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
              <button type="button" className="chatroom-circle-btn" aria-label="More">
                <span className="icon-dots-vertical" />
              </button>
            </div>
          </header>

          {error ? <div className="error-banner">{error}</div> : null}

          <section className="chatroom-thread-body">
            {!roomId && !loadingRooms ? (
              <div className="chatrooms-status-card chatrooms-status-card--center">
                Pick a chat room on the right to open the conversation.
              </div>
            ) : null}

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
                const ownMessage = isOwnMessage(message);
                const bubbleClass = ownMessage
                  ? "chatroom-message chatroom-message--own"
                  : "chatroom-message";

                return (
                  <article key={entry.key} className={bubbleClass}>
                    {renderMessageContent(message)}
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
            <button type="button" className="chatroom-composer__addon" aria-label="More actions">
              <span className="icon-plus" />
            </button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={1}
              placeholder="Type a message..."
            />
            <button
              type="submit"
              className="chatroom-composer__send"
              disabled={!draft.trim() || sending || !roomId}
              aria-label="Send message"
            >
              <span className={sending ? "icon-loader" : "icon-mic"} />
            </button>
          </form>
        </section>

        <aside className="chatrooms-sidebar">
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
                const itemParticipant = room?.participants?.[0] || null;
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
                        itemParticipant?.profileImage ||
                        itemParticipant?.avatar ||
                        staticImage("yenkasa_web_assets/yenkasa_logo.png")
                      }
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
      </div>
    </main>
  );
}

function isOwnMessage(message) {
  const currentUserId =
    CURRENT_USER?._id || CURRENT_USER?.id || CURRENT_USER?.userId || "";
  const senderId = message?.senderId?._id || message?.senderId || "";
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
