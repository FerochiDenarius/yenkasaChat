import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getChatRoom, getChatRoomReceiver } from "../api/chatrooms";
import { getRoomMessages, markRoomAsRead, sendRoomMessage } from "../api/messages";
import { formatRelativeTime } from "../utils/format";
import { handleDynamicImageError, staticImage } from "../utils/images";
import "../styles/chatrooms.css";

export default function ChatRoomThread() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId } = useParams();
  const [participant, setParticipant] = useState(location.state?.participant || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRoom() {
      setLoading(true);
      setError("");

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
            location.state?.participant ||
            null
        );
        setMessages(Array.isArray(roomMessages) ? roomMessages : []);
        await markRoomAsRead(roomId).catch(() => null);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Failed to load chat."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    if (roomId) {
      loadRoom();
    }

    return () => {
      active = false;
    };
  }, [roomId, location.state?.participant]);

  const title = participant?.username || "Chat";
  const subtitle = participant?.isOnline ? "online" : "Last seen recently";
  const renderedMessages = useMemo(() => messages.filter(Boolean), [messages]);

  async function handleSend(event) {
    event.preventDefault();
    const messageText = text.trim();
    if (!roomId || !messageText || sending) return;

    setSending(true);
    setError("");

    try {
      const created = await sendRoomMessage({
        roomId,
        text: messageText,
      });
      setMessages((prev) => [...prev, created]);
      setText("");
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
    <main className="chatroom-thread-page">
      <div className="chatroom-thread-shell">
        <header className="chatroom-thread-header">
          <button
            type="button"
            className="chatrooms-icon-btn"
            onClick={() => navigate("/chatrooms")}
          >
            ←
          </button>
          <img
            className="chatroom-thread-header__avatar"
            src={
              participant?.profileImage ||
              participant?.avatar ||
              staticImage("default.png")
            }
            onError={handleDynamicImageError}
            alt={title}
          />
          <div className="chatroom-thread-header__copy">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="chatroom-thread-messages">
          {loading ? (
            <div className="chatrooms-status-card">Loading chat...</div>
          ) : null}

          {!loading && !renderedMessages.length ? (
            <div className="chatrooms-status-card">
              No messages yet. Say hello to start the conversation.
            </div>
          ) : null}

          {renderedMessages.map((message) => {
            const ownMessage =
              String(message?.senderId?._id || message?.senderId || "") !==
              String(participant?._id || "");

            return (
              <article
                key={message?._id || `${message?.timestamp}-${message?.text}`}
                className={`chatroom-message${
                  ownMessage ? " chatroom-message--own" : ""
                }`}
              >
                {message?.text ? (
                  <div className="chatroom-message__bubble">{message.text}</div>
                ) : message?.imageUrl ? (
                  <div className="chatroom-message__bubble chatroom-message__bubble--media">
                    <img src={message.imageUrl} alt="Sent media" />
                  </div>
                ) : message?.videoUrl ? (
                  <div className="chatroom-message__bubble chatroom-message__bubble--media">
                    <video src={message.videoUrl} controls playsInline preload="metadata" />
                  </div>
                ) : message?.audioUrl ? (
                  <div className="chatroom-message__bubble chatroom-message__bubble--media">
                    <audio src={message.audioUrl} controls preload="metadata" />
                  </div>
                ) : (
                  <div className="chatroom-message__bubble">Unsupported message</div>
                )}
                <span className="chatroom-message__time">
                  {formatRelativeTime(message?.timestamp || message?.createdAt)}
                </span>
              </article>
            );
          })}
        </section>

        <form className="chatroom-thread-composer" onSubmit={handleSend}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={1}
            placeholder="Type a message..."
          />
          <button type="submit" disabled={sending || !text.trim()}>
            {sending ? "..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
