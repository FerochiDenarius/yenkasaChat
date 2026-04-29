import { useEffect, useRef } from "react";
import useNotificationCount from "../../hooks/useNotificationCount";

export default function NotificationSoundBridge() {
  const unreadCount = useNotificationCount(10000);
  const audioContextRef = useRef(null);
  const unlockedRef = useRef(false);
  const previousCountRef = useRef(null);

  useEffect(() => {
    function unlockAudio() {
      if (unlockedRef.current) return;

      const AudioContextCtor =
        window.AudioContext || window.webkitAudioContext || null;

      if (!AudioContextCtor) return;

      const context = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        context.resume().catch(() => null);
      }

      unlockedRef.current = true;
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    const previous = previousCountRef.current;

    if (previous == null) {
      previousCountRef.current = unreadCount;
      return;
    }

    if (unreadCount > previous && unlockedRef.current) {
      playNotificationChime(audioContextRef.current);
    }

    previousCountRef.current = unreadCount;
  }, [unreadCount]);

  return null;
}

function playNotificationChime(context) {
  const selectedSound = window.localStorage.getItem("yenkasa_notification_sound") || "sound_default";
  if (selectedSound === "sound_off") return;

  const AudioContextCtor =
    window.AudioContext || window.webkitAudioContext || null;
  const audioContext = context || (AudioContextCtor ? new AudioContextCtor() : null);
  if (!audioContext) return;

  try {
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillatorA = audioContext.createOscillator();
    const oscillatorB = audioContext.createOscillator();

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    const profile = resolveSoundProfile(selectedSound);

    oscillatorA.type = profile.primaryType;
    oscillatorA.frequency.setValueAtTime(profile.primaryFrom, now);
    oscillatorA.frequency.exponentialRampToValueAtTime(profile.primaryTo, now + 0.14);

    oscillatorB.type = profile.secondaryType;
    oscillatorB.frequency.setValueAtTime(profile.secondaryFrom, now + 0.02);
    oscillatorB.frequency.exponentialRampToValueAtTime(profile.secondaryTo, now + 0.2);

    oscillatorA.connect(gain);
    oscillatorB.connect(gain);
    gain.connect(audioContext.destination);

    oscillatorA.start(now);
    oscillatorB.start(now + 0.04);
    oscillatorA.stop(now + 0.28);
    oscillatorB.stop(now + 0.42);
  } catch {
    // Ignore browser audio failures silently.
  }
}

function resolveSoundProfile(soundId) {
  switch (soundId) {
    case "sound_chime":
      return {
        primaryType: "triangle",
        primaryFrom: 740,
        primaryTo: 988,
        secondaryType: "sine",
        secondaryFrom: 988,
        secondaryTo: 1318,
      };
    case "sound_bell":
      return {
        primaryType: "sine",
        primaryFrom: 1046,
        primaryTo: 1318,
        secondaryType: "triangle",
        secondaryFrom: 784,
        secondaryTo: 1046,
      };
    case "sound_soft":
      return {
        primaryType: "sine",
        primaryFrom: 660,
        primaryTo: 880,
        secondaryType: "sine",
        secondaryFrom: 440,
        secondaryTo: 660,
      };
    case "sound_alert":
      return {
        primaryType: "square",
        primaryFrom: 880,
        primaryTo: 988,
        secondaryType: "triangle",
        secondaryFrom: 698,
        secondaryTo: 784,
      };
    default:
      return {
        primaryType: "sine",
        primaryFrom: 880,
        primaryTo: 1174,
        secondaryType: "triangle",
        secondaryFrom: 660,
        secondaryTo: 880,
      };
  }
}
