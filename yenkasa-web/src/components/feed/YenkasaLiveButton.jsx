export default function YenkasaLiveButton({ onClick }) {
  return (
    <button
      className="feed-live-button"
      type="button"
      aria-label="Open Yenkasa Live"
      onClick={onClick}
    >
      <span className="feed-live-button__bolt">⚡</span>
    </button>
  );
}
