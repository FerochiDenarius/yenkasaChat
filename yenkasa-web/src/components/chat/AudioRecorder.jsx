export default function AudioRecorder({ recording, onToggle }) {
  return (
    <button
      type="button"
      className={`chatroom-composer__mic${recording ? " is-recording" : ""}`}
      onClick={onToggle}
      aria-label={recording ? "Stop recording" : "Record audio"}
    >
      <span>{recording ? "■" : "●"}</span>
    </button>
  );
}
