import { forwardRef, useImperativeHandle, useRef } from "react";

const MediaPicker = forwardRef(function MediaPicker({ onPick }, ref) {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openImage: () => imageInputRef.current?.click(),
    openVideo: () => videoInputRef.current?.click(),
    openAudio: () => audioInputRef.current?.click(),
    openFile: () => fileInputRef.current?.click(),
  }));

  function handleChange(event, type) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPick(file, type);
  }

  return (
    <>
      <input
        ref={imageInputRef}
        className="chatroom-hidden-input"
        type="file"
        accept="image/*"
        onChange={(event) => handleChange(event, "image")}
      />
      <input
        ref={videoInputRef}
        className="chatroom-hidden-input"
        type="file"
        accept="video/*"
        onChange={(event) => handleChange(event, "video")}
      />
      <input
        ref={audioInputRef}
        className="chatroom-hidden-input"
        type="file"
        accept="audio/*"
        onChange={(event) => handleChange(event, "audio")}
      />
      <input
        ref={fileInputRef}
        className="chatroom-hidden-input"
        type="file"
        onChange={(event) => handleChange(event, "file")}
      />
    </>
  );
});

export default MediaPicker;
