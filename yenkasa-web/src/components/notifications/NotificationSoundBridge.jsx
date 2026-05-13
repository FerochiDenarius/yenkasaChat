import { useEffect, useRef } from "react";
import { getNotifications } from "../../api/notifications";
import {
  getNotificationId,
  resolveNotificationTarget,
} from "../../utils/notificationRouting";
import {
  getNotificationSound,
  NOTIFICATION_SOUND_CHANGED_EVENT,
  playNotificationSound,
} from "../../utils/notificationSound";

export default function NotificationSoundBridge() {
  const audioContextRef = useRef(null);
  const unlockedRef = useRef(false);
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const soundIdRef = useRef(getNotificationSound());

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
    function handleSoundChanged(event) {
      soundIdRef.current = event?.detail || getNotificationSound();
    }

    window.addEventListener(NOTIFICATION_SOUND_CHANGED_EVENT, handleSoundChanged);
    window.addEventListener("storage", handleSoundChanged);
    return () => {
      window.removeEventListener(NOTIFICATION_SOUND_CHANGED_EVENT, handleSoundChanged);
      window.removeEventListener("storage", handleSoundChanged);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let pollId;

    async function pollNotifications() {
      try {
        const items = await getNotifications();
        if (!active || !Array.isArray(items)) return;

        const unreadItems = items.filter((item) => item?.status !== "read");
        const unreadIds = unreadItems
          .map((item) => getNotificationId(item))
          .filter(Boolean);

        if (!initializedRef.current) {
          seenIdsRef.current = new Set(unreadIds);
          initializedRef.current = true;
          return;
        }

        const newUnreadItems = unreadItems.filter((item) => {
          const id = getNotificationId(item);
          return id && !seenIdsRef.current.has(id);
        });

        if (newUnreadItems.length) {
          newUnreadItems.forEach((item) => {
            const id = getNotificationId(item);
            if (id) seenIdsRef.current.add(id);
          });

          if (unlockedRef.current) {
            playNotificationSound(audioContextRef.current, soundIdRef.current);
          }

          newUnreadItems.forEach(showBrowserNotification);
        }

        seenIdsRef.current = new Set([
          ...Array.from(seenIdsRef.current),
          ...unreadIds,
        ]);
      } catch {
        // Notification polling should never interrupt the foreground app.
      }
    }

    pollNotifications();
    pollId = window.setInterval(pollNotifications, 10000);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  return null;
}

function showBrowserNotification(notification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (window.Notification.permission !== "granted") return;

  const id = getNotificationId(notification);
  const title = notification?.sender?.username
    ? `Yenkasa - ${notification.sender.username}`
    : "Yenkasa";
  const body = notification?.message || "New activity on your account";

  try {
    const alert = new window.Notification(title, {
      body,
      tag: id || undefined,
      renotify: Boolean(id),
      icon: "/logo.png",
      badge: "/logo.png",
    });

    alert.onclick = () => {
      window.focus();
      window.location.assign(resolveNotificationTarget(notification));
      alert.close();
    };
  } catch {
    // Some browsers reject notifications in unsupported contexts.
  }
}
