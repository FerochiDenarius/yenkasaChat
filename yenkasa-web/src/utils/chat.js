export const CHAT_BACKGROUND_PRESETS = [
  { key: "default", label: "Default" },
  { key: "cream", label: "Cream" },
  { key: "savanna", label: "Savanna" },
  { key: "mint", label: "Mint" },
  { key: "ocean", label: "Ocean" },
  { key: "sunset", label: "Sunset" },
  { key: "graphite", label: "Graphite" },
];

export function getUserId(user) {
  return String(user?._id || user?.id || user?.userId || user?.uid || "");
}

export function inferUploadType(file) {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("video/")) return "video";
  if (file?.type?.startsWith("audio/")) return "audio";
  return "file";
}

export function selectedMediaLabel(media) {
  if (!media) return "";
  if (media.type === "image") return "Photo ready";
  if (media.type === "video") return "Video ready";
  if (media.type === "audio") return "Audio ready";
  return media.name || "File ready";
}

export function replyingToLabel(message, currentUserId, participant) {
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

export function getUserImage(user) {
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

export function getRoomParticipant(room, currentUserId) {
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

export function normalizeChatRooms(rooms, currentUserId) {
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

export function getRoomActivityTime(room) {
  const value =
    room?.lastMessageTime ||
    room?.lastMessage?.timestamp ||
    room?.lastMessage?.createdAt ||
    room?.createdAt;
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isOwnMessage(message, currentUser) {
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

export function renderPreview(message) {
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

export function renderReplyPreview(message) {
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

export function extractFileLabel(url) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "Attachment";
  } catch {
    return "Attachment";
  }
}

export function formatClock(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateChip(value) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRoomTimestamp(value) {
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

export function groupMessagesByDate(messages) {
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
}
