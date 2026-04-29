import { useEffect, useRef, useState } from "react";
import { deleteRoomMessage, editRoomMessage, sendRoomMessage, uploadRoomMedia } from "../api/messages";

export default function useChatComposer({
  roomId,
  setMessages,
  setRooms,
  participant,
}) {
  const composerTextareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);

  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [chatBackground, setChatBackground] = useState(
    () => window.localStorage.getItem("yenkasa_chat_background") || "default"
  );
  const [customBackground, setCustomBackground] = useState(
    () => window.localStorage.getItem("yenkasa_chat_custom_background") || ""
  );
  const [swipeState, setSwipeState] = useState(null);
  const [draft, setDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");

  const canSend = Boolean(draft.trim() || selectedMedia);
  const threadStyle =
    chatBackground === "custom" && customBackground
      ? { "--chat-custom-background": `url("${customBackground}")` }
      : undefined;

  useEffect(() => {
    return () => {
      if (selectedMedia?.previewUrl) {
        window.URL.revokeObjectURL(selectedMedia.previewUrl);
      }
    };
  }, [selectedMedia]);

  useEffect(() => {
    setChatNotice("");
  }, [participant?._id, participant?.id]);

  async function sendMessage() {
    const text = draft.trim();
    if (!roomId || !canSend || sending || uploadingMedia) return false;
    setSending(true);
    setUploadingMedia(Boolean(selectedMedia));
    setComposerError("");
    setChatNotice("");

    try {
      if (editingMessageId) {
        const updated = await editRoomMessage(editingMessageId, text);
        setMessages((prev) =>
          prev.map((message) =>
            (message?._id || message?.id) === editingMessageId ? updated : message
          )
        );
        setRooms((prev) =>
          prev.map((room) =>
            room._id === roomId && room?.lastMessage && (room.lastMessage?._id || room.lastMessage?.id) === editingMessageId
              ? {
                  ...room,
                  lastMessage: updated,
                  lastMessageTime:
                    updated?.timestamp || updated?.createdAt || room.lastMessageTime,
                }
              : room
          )
        );
        setDraft("");
        setEditingMessageId("");
        return true;
      }

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
      return true;
    } catch (requestError) {
      setComposerError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError?.message ||
          "Failed to send message."
      );
      return false;
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  }

  function pickMedia(file, forcedType) {
    if (!file) return;
    if (selectedMedia?.previewUrl) window.URL.revokeObjectURL(selectedMedia.previewUrl);
    setSelectedMedia({
      file,
      type: forcedType || "file",
      name: file.name || `${forcedType || "file"} upload`,
      previewUrl: window.URL.createObjectURL(file),
    });
  }

  function clearSelectedMedia() {
    setSelectedMedia((current) => {
      if (current?.previewUrl) window.URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  function showReply(message) {
    setEditingMessageId("");
    setReplyingTo(message);
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
  }

  function clearReplyingTo() {
    setReplyingTo(null);
  }

  function startEditingMessage(message) {
    const messageId = message?._id || message?.id;
    if (!messageId || !message?.text || message?.imageUrl || message?.videoUrl || message?.audioUrl || message?.fileUrl) {
      setComposerError("Only plain text messages can be edited.");
      return;
    }
    setReplyingTo(null);
    clearSelectedMedia();
    setEditingMessageId(String(messageId));
    setDraft(message.text || "");
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
  }

  async function removeMessage(message) {
    const messageId = message?._id || message?.id;
    if (!messageId) return false;
    if (!window.confirm("Delete this message?")) return false;
    setComposerError("");
    setChatNotice("");
    try {
      await deleteRoomMessage(messageId);
      setMessages((prev) => prev.filter((item) => (item?._id || item?.id) !== messageId));
      setRooms((prev) =>
        prev.map((room) =>
          room._id === roomId && (room.lastMessage?._id || room.lastMessage?.id) === messageId
            ? { ...room, lastMessage: null }
            : room
        )
      );
      if (editingMessageId === String(messageId)) {
        setEditingMessageId("");
        setDraft("");
      }
      return true;
    } catch (requestError) {
      setComposerError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Failed to delete message."
      );
      return false;
    }
  }

  function cancelEditingMessage() {
    setEditingMessageId("");
    setDraft("");
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
        if (event.data?.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: blob.type });
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
        if (blob.size) pickMedia(file, "audio");
      };
      recorder.start();
      setRecording(true);
      setComposerError("");
    } catch (requestError) {
      setRecording(false);
      setComposerError(
        requestError?.message ||
          "Microphone permission is needed before sending an audio message."
      );
    }
  }

  function setBackgroundPreset(nextBackground) {
    setChatBackground(nextBackground);
    window.localStorage.setItem("yenkasa_chat_background", nextBackground);
  }

  function setCustomBackgroundFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setCustomBackground(result);
      setChatBackground("custom");
      window.localStorage.setItem("yenkasa_chat_custom_background", result);
      window.localStorage.setItem("yenkasa_chat_background", "custom");
    };
    reader.readAsDataURL(file);
  }

  return {
    composerTextareaRef,
    sending,
    uploadingMedia,
    recording,
    composerError,
    chatNotice,
    setChatNotice,
    replyingTo,
    selectedMedia,
    chatBackground,
    editingMessageId,
    swipeState,
    setSwipeState,
    draft,
    setDraft,
    canSend,
    threadStyle,
    sendMessage,
    pickMedia,
    clearSelectedMedia,
    showReply,
    clearReplyingTo,
    startEditingMessage,
    removeMessage,
    cancelEditingMessage,
    toggleAudioRecording,
    setBackgroundPreset,
    setCustomBackgroundFile,
  };
}
