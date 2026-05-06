import { useEffect, useRef, useState } from "react";

export default function YenkasaWebPlayerControls({ mediaRef, active, hasMedia, type }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!hasMedia || !mediaRef?.current) return undefined;
    const media = mediaRef.current;

    function sync() {
      setPlaying(!media.paused);
      setMuted(Boolean(media.muted));
      setCurrentTime(Number(media.currentTime || 0));
      setDuration(Number(media.duration || 0));
      rafRef.current = window.requestAnimationFrame(sync);
    }

    rafRef.current = window.requestAnimationFrame(sync);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [hasMedia, mediaRef, active]);

  if (!hasMedia) return null;

  function togglePlay() {
    const media = mediaRef?.current;
    if (!media) return;
    if (media.paused) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  }

  function seek(event) {
    const media = mediaRef?.current;
    if (!media || !duration) return;
    media.currentTime = Number(event.target.value || 0);
  }

  function skip(seconds) {
    const media = mediaRef?.current;
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(Number(media.duration || 0), Number(media.currentTime || 0) + seconds));
  }

  function toggleMute() {
    const media = mediaRef?.current;
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }

  return (
    <section className="player-controls" aria-label={`${type} controls`}>
      <div className="player-controls__timeline">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || currentTime)}
          onChange={seek}
          aria-label="Seek media"
        />
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
      <div className="player-controls__buttons">
        <button type="button" onClick={() => skip(-10)} aria-label="Back 10 seconds">⏮</button>
        <button type="button" className="player-controls__play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={() => skip(10)} aria-label="Forward 10 seconds">⏭</button>
        <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </section>
  );
}

function formatTime(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
