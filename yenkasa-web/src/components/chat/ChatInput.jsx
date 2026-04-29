import { useRef, useState } from "react";
import AudioRecorder from "./AudioRecorder";
import MediaPicker from "./MediaPicker";
import ReplyPreview from "./ReplyPreview";
import { selectedMediaLabel } from "../../utils/chat";

export default function ChatInput({
  draft,
  setDraft,
  onSend,
  canSend,
  sending,
  uploadingMedia,
  roomId,
  recording,
  onToggleRecording,
  selectedMedia,
  onClearSelectedMedia,
  replyingTo,
  currentUserId,
  participant,
  onClearReply,
  onPickMedia,
  textareaRef,
}) {
  const [attachOpen, setAttachOpen] = useState(false);
  const mediaPickerRef = useRef(null);

  function handleSubmit(event) {
    event.preventDefault();
    onSend();
  }

  return (
    <form className="chatroom-composer" onSubmit={handleSubmit}>
      <ReplyPreview
        replyingTo={replyingTo}
        currentUserId={currentUserId}
        participant={participant}
        onClear={onClearReply}
      />

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
          <button type="button" onClick={onClearSelectedMedia} aria-label="Remove media">
            ×
          </button>
        </div>
      ) : null}

      {attachOpen ? (
        <div className="chatroom-attach-menu">
          <button type="button" onClick={() => mediaPickerRef.current?.openImage()}>
            Photo
          </button>
          <button type="button" onClick={() => mediaPickerRef.current?.openVideo()}>
            Video
          </button>
          <button type="button" onClick={() => mediaPickerRef.current?.openAudio()}>
            Audio
          </button>
          <button type="button" onClick={() => mediaPickerRef.current?.openFile()}>
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
        ref={textareaRef}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (attachOpen) setAttachOpen(false);
        }}
        rows={1}
        placeholder="Type a message..."
      />
      {!canSend ? <AudioRecorder recording={recording} onToggle={onToggleRecording} /> : null}
      <button
        type="submit"
        className="chatroom-composer__send"
        disabled={!canSend || sending || uploadingMedia || !roomId}
        aria-label="Send message"
      >
        <span className={sending || uploadingMedia ? "icon-loader" : "icon-send"} />
      </button>
      <MediaPicker
        ref={mediaPickerRef}
        onPick={onPickMedia}
      />
    </form>
  );
}
