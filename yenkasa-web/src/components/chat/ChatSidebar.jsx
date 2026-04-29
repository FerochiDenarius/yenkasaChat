import { getRoomParticipant, getUserImage, formatRoomTimestamp, renderPreview } from "../../utils/chat";
import { handleDynamicImageError, staticImage } from "../../utils/images";

export default function ChatSidebar({
  rooms,
  roomId,
  currentUserId,
  loadingRooms,
  roomsError,
  searchUsername,
  setSearchUsername,
  creatingRoom,
  onCreateRoom,
  onSelectRoom,
}) {
  function handleSubmit(event) {
    event.preventDefault();
    onCreateRoom(searchUsername);
  }

  return (
    <aside className="chatrooms-sidebar chatrooms-sidebar--standalone">
      <header className="chatrooms-sidebar__header">
        <div>
          <strong>Your Chat Rooms</strong>
          <span>Find people by username and continue your chats.</span>
        </div>
      </header>

      <form className="chatrooms-create-form" onSubmit={handleSubmit}>
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

        {loadingRooms ? <div className="chatrooms-status-card">Loading chat rooms...</div> : null}

        {!loadingRooms && !rooms.length ? (
          <div className="chatrooms-status-card">
            No chat rooms yet. Search for a username to start chatting.
          </div>
        ) : null}

        {!loadingRooms &&
          rooms.map((room) => {
            const participant = getRoomParticipant(room, currentUserId);
            const isActive = room?._id === roomId;

            return (
              <button
                key={room?._id}
                type="button"
                className={`chatrooms-room${isActive ? " is-active" : ""}`}
                onClick={() => onSelectRoom(room?._id)}
              >
                <img
                  className="chatrooms-room__avatar"
                  src={getUserImage(participant) || staticImage("default.png")}
                  onError={handleDynamicImageError}
                  alt={participant?.username || "Chat room"}
                />
                <div className="chatrooms-room__copy">
                  <span className="chatrooms-room__time">
                    {formatRoomTimestamp(room?.lastMessageTime)}
                  </span>
                  <strong>{participant?.username || "Unknown user"}</strong>
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
  );
}
