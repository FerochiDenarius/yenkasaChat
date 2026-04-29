import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/feed/BottomNav";
import {
  getNotificationPreferences,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "../api/notifications";
import { staticImage } from "../utils/images";
import "../styles/notifications.css";

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({
    inAppEnabled: true,
    rewardEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState("");
  const [savingPref, setSavingPref] = useState("");

  useEffect(() => {
    let active = true;
    let pollId;

    async function loadPage(showLoader = true) {
      if (showLoader) setLoading(true);
      try {
        const [prefs, items] = await Promise.all([
          getNotificationPreferences().catch(() => ({
            inAppEnabled: true,
            rewardEnabled: true,
          })),
          getNotifications(),
        ]);

        if (!active) return;
        setPreferences({
          inAppEnabled: prefs?.inAppEnabled !== false,
          rewardEnabled: prefs?.rewardEnabled !== false,
        });
        setNotifications(Array.isArray(items) ? items : []);
        setError("");
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Failed to load notifications."
        );
      } finally {
        if (active && showLoader) setLoading(false);
      }
    }

    loadPage();
    pollId = window.setInterval(() => loadPage(false), 10000);

    return () => {
      active = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  const groupedNotifications = useMemo(() => {
    const groups = [];
    let currentLabel = "";

    notifications.forEach((notification) => {
      const label = formatSectionDate(notification?.createdAt);
      if (label !== currentLabel) {
        groups.push({ type: "label", key: `label-${label}`, label });
        currentLabel = label;
      }
      groups.push({
        type: "item",
        key: notification?.id || notification?._id,
        notification,
      });
    });

    return groups;
  }, [notifications]);

  const unreadCount = notifications.filter(
    (notification) => notification?.status !== "read"
  ).length;

  async function handleOpen(notification) {
    if (!notification) return;

    if (notification?.status !== "read") {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.filter((item) => item.id !== notification.id)
        );
      } catch {
        // keep navigation responsive even if mark-read fails
      }
    }

    const nextPath = resolveNotificationTarget(notification);
    navigate(nextPath);
  }

  async function handleMarkAll() {
    if (!notifications.length || busyAll) return;
    setBusyAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications([]);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Failed to mark all notifications as read."
      );
    } finally {
      setBusyAll(false);
    }
  }

  async function handleTogglePreference(key, value) {
    setSavingPref(key);
    try {
      const next = await updateNotificationPreferences({ [key]: value });
      setPreferences({
        inAppEnabled: next?.inAppEnabled !== false,
        rewardEnabled: next?.rewardEnabled !== false,
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Failed to update notification preferences."
      );
    } finally {
      setSavingPref("");
    }
  }

  return (
    <main className="notifications-page page page--with-nav">
      <header className="notifications-header">
        <button
          type="button"
          className="notifications-header__back"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          ←
        </button>
        <div className="notifications-header__copy">
          <div className="page-header__eyebrow">Yenkasa Alerts</div>
          <h1>Notifications</h1>
          <p>
            {unreadCount
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "All caught up"}
          </p>
        </div>
        <button
          type="button"
          className="notifications-header__mark-all"
          onClick={handleMarkAll}
          disabled={!notifications.length || busyAll}
        >
          {busyAll ? "..." : "Mark all"}
        </button>
      </header>

      <section className="notifications-prefs">
        <PreferenceToggle
          label="In-app notifications"
          description="Show activity, approval, and account alerts."
          checked={preferences.inAppEnabled}
          disabled={savingPref === "inAppEnabled"}
          onChange={(value) => handleTogglePreference("inAppEnabled", value)}
        />
        <PreferenceToggle
          label="Reward notifications"
          description="Wallet and reward alerts from Yenkasa activity."
          checked={preferences.rewardEnabled}
          disabled={savingPref === "rewardEnabled" || !preferences.inAppEnabled}
          onChange={(value) => handleTogglePreference("rewardEnabled", value)}
        />
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="notifications-list">
        {loading ? (
          <div className="notifications-empty">Loading notifications...</div>
        ) : null}

        {!loading && !notifications.length ? (
          <div className="notifications-empty">
            <img
              src={staticImage("yenkasa_web_assets/yenkasa_logo.png")}
              alt="Yenkasa"
            />
            <strong>No notifications yet</strong>
            <p>Likes, comments, approvals, and account alerts will appear here.</p>
          </div>
        ) : null}

        {!loading &&
          groupedNotifications.map((entry) => {
            if (entry.type === "label") {
              return (
                <div key={entry.key} className="notifications-section-label">
                  {entry.label}
                </div>
              );
            }

            const notification = entry.notification;
            return (
              <button
                key={entry.key}
                type="button"
                className={`notification-card${
                  notification?.status !== "read" ? " notification-card--unread" : ""
                }`}
                onClick={() => handleOpen(notification)}
              >
                <img
                  className="notification-card__avatar"
                  src={
                    notification?.sender?.avatar ||
                    staticImage("yenkasa_web_assets/yenkasa_logo.png")
                  }
                  alt={notification?.sender?.username || "Notification"}
                />
                <div className="notification-card__copy">
                  <div className="notification-card__row">
                    <strong>{notification?.sender?.username || "Yenkasa"}</strong>
                    <span>{formatClock(notification?.createdAt)}</span>
                  </div>
                  <p>{notification?.message || "New activity on your account"}</p>
                  <small>{formatNotificationMeta(notification)}</small>
                </div>
                {notification?.status !== "read" ? (
                  <span className="notification-card__dot" />
                ) : null}
              </button>
            );
          })}
      </section>

      <BottomNav />
    </main>
  );
}

function PreferenceToggle({ label, description, checked, disabled, onChange }) {
  return (
    <label className={`notifications-toggle${disabled ? " is-disabled" : ""}`}>
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        className={`notifications-toggle__switch${checked ? " is-on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span />
      </button>
    </label>
  );
}

function resolveNotificationTarget(notification) {
  const url = notification?.targetUrl;
  if (url) {
    if (url.startsWith("/admin/post-approval")) return "/post-approvals";
    if (url.startsWith("/post/")) return url;
    if (url.startsWith("/profile/")) return "/profile";
    return url;
  }

  if (notification?.postId) return `/post/${notification.postId}`;
  if (notification?.commentId && notification?.activityId) {
    return `/post/${notification.activityId}?openComments=true`;
  }
  if (notification?.targetType === "profile") return "/profile";
  return "/notifications";
}

function formatSectionDate(value) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfInput) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatClock(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNotificationMeta(notification) {
  const parts = [];
  if (notification?.type) parts.push(normalizeTypeLabel(notification.type));
  if (notification?.targetType) parts.push(notification.targetType);
  return parts.join(" • ");
}

function normalizeTypeLabel(type) {
  return String(type || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
