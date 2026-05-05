export default function YenkasaWebLiveArenaButton({ onClick }) {
  return (
    <button
      type="button"
      className="player-live-arena"
      onClick={onClick}
      aria-label="Open Yenkasa Live Arena"
    >
      <span className="player-live-arena__ring" />
      <span className="player-live-arena__icon">🏆</span>
      <strong>YENKASA</strong>
      <strong>LIVE ARENA</strong>
      <small>Join Now</small>
    </button>
  );
}
