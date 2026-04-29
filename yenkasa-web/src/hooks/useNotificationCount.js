import { useEffect, useState } from "react";
import { getNotifications } from "../api/notifications";

export default function useNotificationCount(pollMs = 15000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    let pollId;

    async function loadCount() {
      try {
        const notifications = await getNotifications();
        if (!active) return;
        const unread = Array.isArray(notifications)
          ? notifications.filter((item) => item?.status !== "read").length
          : 0;
        setCount(unread);
      } catch {
        if (active) setCount((prev) => prev);
      }
    }

    loadCount();
    pollId = window.setInterval(loadCount, pollMs);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [pollMs]);

  return count;
}
