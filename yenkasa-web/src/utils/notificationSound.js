export const NOTIFICATION_SOUND_KEY = "yenkasa_notification_sound";
export const NOTIFICATION_SOUND_CHANGED_EVENT = "yenkasa:notification-sound-changed";

export const NOTIFICATION_SOUND_OPTIONS = [
  { id: "sound_off", labelKey: "notificationSoundOff" },
  { id: "sound_default", labelKey: "notificationSoundDefault" },
  { id: "sound_chime", labelKey: "notificationSoundChime" },
  { id: "sound_bell", labelKey: "notificationSoundBell" },
  { id: "sound_soft", labelKey: "notificationSoundSoft" },
  { id: "sound_alert", labelKey: "notificationSoundAlert" },
];

export function getNotificationSound() {
  return normalizeNotificationSound(window.localStorage.getItem(NOTIFICATION_SOUND_KEY));
}

export function saveNotificationSound(soundId) {
  const normalized = normalizeNotificationSound(soundId);
  window.localStorage.setItem(NOTIFICATION_SOUND_KEY, normalized);
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_SOUND_CHANGED_EVENT, { detail: normalized })
  );
  return normalized;
}

export function normalizeNotificationSound(soundId) {
  const candidate = String(soundId || "sound_default").trim();
  return NOTIFICATION_SOUND_OPTIONS.some((item) => item.id === candidate)
    ? candidate
    : "sound_default";
}

export function playNotificationSound(context, soundId = getNotificationSound()) {
  const selectedSound = normalizeNotificationSound(soundId);
  if (selectedSound === "sound_off") return;

  const AudioContextCtor =
    window.AudioContext || window.webkitAudioContext || null;
  const audioContext = context || (AudioContextCtor ? new AudioContextCtor() : null);
  if (!audioContext) return;

  try {
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => null);
    }

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillatorA = audioContext.createOscillator();
    const oscillatorB = audioContext.createOscillator();
    const profile = resolveSoundProfile(selectedSound);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

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
    // Browser audio can be blocked by user settings; notification delivery should continue.
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

