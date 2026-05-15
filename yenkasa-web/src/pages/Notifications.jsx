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
import { useLocale } from "../i18n/LocaleContext";
import { handleDynamicImageError, handleStaticImageError, staticImage } from "../utils/images";
import {
  getNotificationId,
  resolveNotificationTarget,
} from "../utils/notificationRouting";
import "../styles/notifications.css";

export default function Notifications() {
  const navigate = useNavigate();
  const { language, t } = useLocale();
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({
    inAppEnabled: true,
    rewardEnabled: true,
    communityPostEnabled: true,
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
            communityPostEnabled: true,
          })),
          getNotifications(),
        ]);

        if (!active) return;
        setPreferences({
          inAppEnabled: prefs?.inAppEnabled !== false,
          rewardEnabled: prefs?.rewardEnabled !== false,
          communityPostEnabled: prefs?.communityPostEnabled !== false,
        });
        setNotifications(Array.isArray(items) ? items : []);
        setError("");
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            t("notificationsLoadFailed", "Failed to load notifications.")
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
      const label = formatSectionDate(notification?.createdAt, language, t);
      if (label !== currentLabel) {
        groups.push({ type: "label", key: `label-${label}`, label });
        currentLabel = label;
      }
      groups.push({
        type: "item",
        key: getNotificationId(notification),
        notification,
      });
    });

    return groups;
  }, [notifications, language, t]);

  const unreadCount = notifications.filter(
    (notification) => notification?.status !== "read"
  ).length;

  async function handleOpen(notification) {
    if (!notification) return;

    if (notification?.status !== "read") {
      const notificationId = getNotificationId(notification);
      try {
        if (notificationId) await markNotificationRead(notificationId);
        setNotifications((prev) =>
          prev.filter((item) => getNotificationId(item) !== notificationId)
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
          t("markNotificationsReadFailed", "Failed to mark all notifications as read.")
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
        communityPostEnabled: next?.communityPostEnabled !== false,
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          t("notificationSettingsSaveFailed", "Failed to update notification preferences.")
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
          <div className="page-header__eyebrow">{t("yenkasaAlerts", "Yenkasa Alerts")}</div>
          <h1>{t("notifications")}</h1>
          <p>
            {unreadCount
              ? unreadNotificationLabel(unreadCount, t)
              : t("allCaughtUp")}
          </p>
        </div>
        <button
          type="button"
          className="notifications-header__mark-all"
          onClick={handleMarkAll}
          disabled={!notifications.length || busyAll}
        >
          {busyAll ? "..." : t("markAll")}
        </button>
      </header>

      <section className="notifications-prefs">
        <PreferenceToggle
          label={t("inAppNotifications")}
          description={t("inAppNotificationDescription", "Show activity, approval, and account alerts.")}
          checked={preferences.inAppEnabled}
          disabled={savingPref === "inAppEnabled"}
          onChange={(value) => handleTogglePreference("inAppEnabled", value)}
        />
        <PreferenceToggle
          label={t("rewardNotifications")}
          description={t("rewardNotificationDescription")}
          checked={preferences.rewardEnabled}
          disabled={savingPref === "rewardEnabled" || !preferences.inAppEnabled}
          onChange={(value) => handleTogglePreference("rewardEnabled", value)}
        />
        <PreferenceToggle
          label={t("communityPostNotifications", "Community post notifications")}
          description={t("communityPostNotificationDescription", "Notify me when joined communities publish new posts.")}
          checked={preferences.communityPostEnabled}
          disabled={savingPref === "communityPostEnabled" || !preferences.inAppEnabled}
          onChange={(value) => handleTogglePreference("communityPostEnabled", value)}
        />
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="notifications-list">
        {loading ? (
          <div className="notifications-empty">{t("loadingNotifications")}</div>
        ) : null}

        {!loading && !notifications.length ? (
          <div className="notifications-empty">
            <img
              src={staticImage("logo.png")}
              alt="Yenkasa"
              onError={(event) => handleStaticImageError(event, "logo.png")}
            />
            <strong>{t("noNotificationsYet")}</strong>
            <p>{t("notificationEmptyCopy")}</p>
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
                    notification?.sender?.profileImage ||
                    staticImage("logo.png")
                  }
                  onError={
                    notification?.sender?.avatar || notification?.sender?.profileImage
                      ? handleDynamicImageError
                      : (event) => handleStaticImageError(event, "logo.png")
                  }
                  alt={notification?.sender?.username || t("notification", "Notification")}
                />
                <div className="notification-card__copy">
                  <div className="notification-card__row">
                    <strong>{notification?.sender?.username || "Yenkasa"}</strong>
                    <span>{formatClock(notification?.createdAt, language)}</span>
                  </div>
                  <p>{notification?.message || t("newActivityOnAccount", "New activity on your account")}</p>
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

function formatSectionDate(value, language, t) {
  if (!value) return t("recent", "Recent");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("recent", "Recent");

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfInput) / 86400000);

  if (diffDays <= 0) return t("today", "Today");
  if (diffDays === 1) return t("yesterday", "Yesterday");
  return date.toLocaleDateString(language || undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatClock(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(language || undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function unreadNotificationLabel(count, t) {
  if (count === 1) return t("oneUnreadNotification", "1 unread notification");
  return `${count} ${t("unreadNotifications", "unread notifications")}`;
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
