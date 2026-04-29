import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChatRoom,
  getChatRoom,
  getChatRoomReceiver,
  getChatRooms,
} from "../api/chatrooms";
import { getRoomMessages, markRoomAsRead } from "../api/messages";
import { getStoredUser } from "../utils/storage";
import {
  getRoomParticipant,
  getUserId,
  groupMessagesByDate,
  normalizeChatRooms,
} from "../utils/chat";

export default function useChatData(roomId) {
  const threadEndRef = useRef(null);
  const threadBodyRef = useRef(null);
  const roomsRef = useRef([]);
  const lastScrolledRoomRef = useRef("");
  const previousMessageCountRef = useRef(0);

  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [participant, setParticipant] = useState(null);
  const [messages, setMessages] = useState([]);

  const currentUser = useMemo(() => getStoredUser() || {}, []);
  const currentUserId = useMemo(() => getUserId(currentUser), [currentUser]);
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    let active = true;
    let pollId;

    async function loadRooms(showLoader = true) {
      if (showLoader) setLoadingRooms(true);
      try {
        const data = await getChatRooms();
        if (!active) return;
        setRooms(normalizeChatRooms(Array.isArray(data) ? data : [], currentUserId));
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
    pollId = window.setInterval(() => loadRooms(false), 8000);
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
      if (showLoader) setLoadingThread(true);

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
          prev.map((room) => (room._id === roomId ? { ...room, unreadCount: 0 } : room))
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
    pollId = window.setInterval(() => loadThread(false), 4000);
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
      scrollThreadToBottom(threadEndRef, "auto");
      lastScrolledRoomRef.current = String(roomId || "");
    } else if (nextCount > previousCount && isNearThreadBottom(threadBodyRef)) {
      scrollThreadToBottom(threadEndRef, "smooth");
    }

    previousMessageCountRef.current = nextCount;
  }, [groupedMessages.length, roomId]);

  async function createRoomByUsername(username) {
    const value = username.trim();
    if (!value || creatingRoom) return null;
    setCreatingRoom(true);
    setRoomsError("");
    try {
      const response = await createChatRoom(value);
      if (!response?.success || !response?.roomId) {
        setRoomsError(response?.message || "Could not create chat room.");
        return null;
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
        return exists ? prev : normalizeChatRooms([nextRoom, ...prev], currentUserId);
      });
      return response.roomId;
    } catch (requestError) {
      setRoomsError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Unable to start that chat."
      );
      return null;
    } finally {
      setCreatingRoom(false);
    }
  }

  return {
    threadEndRef,
    threadBodyRef,
    rooms,
    setRooms,
    loadingRooms,
    loadingThread,
    creatingRoom,
    roomsError,
    threadError,
    participant,
    messages,
    setMessages,
    groupedMessages,
    currentUser,
    currentUserId,
    createRoomByUsername,
  };
}

function scrollThreadToBottom(threadEndRef, behavior = "smooth") {
  window.requestAnimationFrame(() => {
    threadEndRef.current?.scrollIntoView({ block: "end", behavior });
  });
}

function isNearThreadBottom(threadBodyRef) {
  const element = threadBodyRef.current;
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 160;
}
