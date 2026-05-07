export default function YenkasaWebLiveArenaButton({ onClick }) {
  return (
    <button
      type="button"
      className="player-live-arena"
      onClick={onClick}
      aria-label="Open Yenkasa Live Arena"
      title="Yenkasa Live Arena"
    >
      <span className="player-live-arena__ring" />
      <span className="player-live-arena__badge">LIVE</span>
      <span className="player-live-arena__icon">≋</span>
      <small>Arena</small>
      <span className="sr-only">Yenkasa Live Arena</span>
    </button>
  );
}
