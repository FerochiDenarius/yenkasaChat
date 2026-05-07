import { useEffect, useRef, useState } from "react";

const PLAYER_MUTED_KEY = "yenkasa_player_muted";
const PLAYER_VOLUME_KEY = "yenkasa_player_volume";
const DEFAULT_VOLUME = 0.85;

export default function YenkasaWebPlayerControls({ mediaRef, active, hasMedia, type }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(() => readMutedPreference());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioToast, setAudioToast] = useState("");
  const rafRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (!hasMedia || !mediaRef?.current) return undefined;
    const media = mediaRef.current;

    applyMutePreference(media);
    setMuted(Boolean(media.muted || media.volume === 0));

    function handleGlobalMuteChange(event) {
      applyMutePreference(media, event.detail);
      setMuted(Boolean(media.muted || media.volume === 0));
    }

    window.addEventListener("yenkasa-player-mute-change", handleGlobalMuteChange);
    return () => window.removeEventListener("yenkasa-player-mute-change", handleGlobalMuteChange);
  }, [hasMedia, mediaRef, active]);

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
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [hasMedia, mediaRef, active]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

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

  function seekTo(edge) {
    const media = mediaRef?.current;
    if (!media) return;
    media.currentTime = edge === "end" ? Math.max(0, Number(media.duration || 0) - 0.1) : 0;
  }

  function toggleMute() {
    const media = mediaRef?.current;
    if (!media) return;
    const nextMuted = !(media.muted || media.volume === 0);
    if (nextMuted) {
      rememberVolume(media.volume);
      media.muted = true;
      media.volume = 0;
    } else {
      media.volume = readVolumePreference();
      media.muted = false;
    }
    writeMutedPreference(nextMuted);
    setMuted(nextMuted);
    showAudioToast(nextMuted ? "Muted" : "Sound On");
    window.dispatchEvent(
      new CustomEvent("yenkasa-player-mute-change", {
        detail: { muted: nextMuted, volume: media.volume },
      })
    );
  }

  function showAudioToast(message) {
    setAudioToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setAudioToast(""), 900);
  }

  return (
    <section className="player-controls" aria-label={`${type} controls`}>
      {audioToast ? <span className="player-controls__audio-toast">{audioToast}</span> : null}
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
        <button type="button" onClick={() => seekTo("start")} aria-label="Restart media">|◀</button>
        <button type="button" onClick={() => skip(-10)} aria-label="Back 10 seconds">↶10</button>
        <button type="button" className="player-controls__play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button type="button" onClick={() => skip(10)} aria-label="Forward 10 seconds">10↷</button>
        <button type="button" onClick={() => seekTo("end")} aria-label="Skip to end">▶|</button>
        <button
          type="button"
          className={`player-controls__mute${muted ? " is-muted" : " is-sound-on"}`}
          onClick={toggleMute}
          aria-label={muted ? "Unmute media" : "Mute media"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
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

function applyMutePreference(media, detail = {}) {
  const shouldMute = typeof detail.muted === "boolean" ? detail.muted : readMutedPreference();
  if (shouldMute) {
    rememberVolume(media.volume);
    media.muted = true;
    media.volume = 0;
    return;
  }
  media.volume = clampVolume(detail.volume ?? readVolumePreference());
  media.muted = false;
}

function readMutedPreference() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(PLAYER_MUTED_KEY) !== "false";
}

function writeMutedPreference(value) {
  try {
    window.localStorage.setItem(PLAYER_MUTED_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage failures in private browsing.
  }
}

function readVolumePreference() {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  return clampVolume(window.localStorage.getItem(PLAYER_VOLUME_KEY) || DEFAULT_VOLUME);
}

function rememberVolume(value) {
  const volume = clampVolume(value);
  if (volume <= 0) return;
  try {
    window.localStorage.setItem(PLAYER_VOLUME_KEY, String(volume));
  } catch {
    // Ignore storage failures in private browsing.
  }
}

function clampVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, volume));
}

function SpeakerOnIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z" />
      <path d="M16 8.2a5.5 5.5 0 0 1 0 7.6" />
      <path d="M18.6 5.8a9.2 9.2 0 0 1 0 12.4" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 9.5v5h3.8L13 19V5L7.8 9.5H4Z" />
      <path d="m17 9 4 4m0-4-4 4" />
    </svg>
  );
}
