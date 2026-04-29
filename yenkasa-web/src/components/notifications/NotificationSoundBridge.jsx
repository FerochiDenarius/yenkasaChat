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

    oscillatorA.type = "sine";
    oscillatorA.frequency.setValueAtTime(880, now);
    oscillatorA.frequency.exponentialRampToValueAtTime(1174, now + 0.14);

    oscillatorB.type = "triangle";
    oscillatorB.frequency.setValueAtTime(660, now + 0.02);
    oscillatorB.frequency.exponentialRampToValueAtTime(880, now + 0.2);

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
