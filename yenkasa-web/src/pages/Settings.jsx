import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatSectionNav from "../components/chat/ChatSectionNav";
import { updateUserProfile } from "../api/profile";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../api/notifications";
import { SUPPORTED_LANGUAGES, useLocale } from "../i18n/LocaleContext";
import {
  getBlockedUsers,
  getCommunityVisibility,
  getHiddenUsers,
  getPrivacy,
  getWhoBlockedYou,
  setPrivacyLevel,
} from "../api/privacy";
import { getStoredUser, getToken } from "../utils/storage";
import {
  getNotificationSound,
  NOTIFICATION_SOUND_OPTIONS,
  playNotificationSound,
  saveNotificationSound,
} from "../utils/notificationSound";
import { canModerate } from "../utils/permissions";
import "../styles/settings.css";

const PRIVACY_OPTIONS = [
  { value: "everyone", labelKey: "everyoneCanMessage" },
  { value: "community_members", labelKey: "communityMembersCanMessage" },
  { value: "requires_approval", labelKey: "messageRequestsRequired" },
  { value: "nobody", labelKey: "noOneCanMessage" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { language, languageLabel, setLanguage, t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [privacyLevel, setPrivacy] = useState("requires_approval");
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [soundId, setSoundId] = useState(getNotificationSound);
  const [browserPermission, setBrowserPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported"
  );
  const [counts, setCounts] = useState({
    blockedUsers: 0,
    blockedBy: 0,
    communities: 0,
    hiddenUsers: 0,
  });
  const [busyKey, setBusyKey] = useState("");

  const canAccessAdmin = useMemo(() => canModerate(getStoredUser()), []);
  const privacyOptions = useMemo(
    () => PRIVACY_OPTIONS.map((option) => ({ ...option, label: t(option.labelKey) })),
    [t]
  );
  const soundOptions = useMemo(
    () =>
      NOTIFICATION_SOUND_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [t]
  );
  const languageOptions = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map((option) => ({
        value: option.code,
        label: `${option.nativeLabel} ${option.flag}`,
      })),
    []
  );

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const [
          privacy,
          preferences,
          blockedUsers,
          blockedBy,
          communityVisibility,
          hiddenUsers,
        ] = await Promise.all([
          getPrivacy().catch(() => ({})),
          getNotificationPreferences().catch(() => ({
            inAppEnabled: true,
            rewardEnabled: true,
          })),
          getBlockedUsers().catch(() => []),
          getWhoBlockedYou().catch(() => []),
          getCommunityVisibility().catch(() => []),
          getHiddenUsers().catch(() => []),
        ]);

        if (!active) return;

        setPrivacy(privacy?.privacyLevel || "requires_approval");
        setInAppEnabled(preferences?.inAppEnabled !== false);
        setRewardEnabled(preferences?.rewardEnabled !== false);
        setCounts({
          blockedUsers: blockedUsers.length,
          blockedBy: blockedBy.length,
          communities: communityVisibility.length,
          hiddenUsers: hiddenUsers.length,
        });
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            t("settingsLoadFailed", "Failed to load settings.")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  async function handlePrivacyChange(nextValue) {
    setBusyKey("privacy");
    setPrivacy(nextValue);
    try {
      await setPrivacyLevel(nextValue);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          t("privacySaveFailed", "Failed to save privacy setting.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleNotificationsChange(key, nextValue) {
    setBusyKey(key);
    if (key === "inAppEnabled") setInAppEnabled(nextValue);
    if (key === "rewardEnabled") setRewardEnabled(nextValue);

    try {
      const next = await updateNotificationPreferences({ [key]: nextValue });
      setInAppEnabled(next?.inAppEnabled !== false);
      setRewardEnabled(next?.rewardEnabled !== false);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          t("notificationSettingsSaveFailed", "Failed to update notification settings.")
      );
    } finally {
      setBusyKey("");
    }
  }

  function handleSoundChange(nextSoundId) {
    const savedSoundId = saveNotificationSound(nextSoundId);
    setSoundId(savedSoundId);
    playNotificationSound(null, savedSoundId);
  }

  async function handleBrowserNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await window.Notification.requestPermission();
      setBrowserPermission(permission);
    } catch {
      // Browsers can reject permission prompts outside supported contexts.
    }
  }

  async function handleLanguageChange(nextLanguage) {
    setLanguage(nextLanguage);
    try {
      await updateUserProfile({ preferredLanguage: nextLanguage });
    } catch {
      // Language is intentionally kept locally if backend sync is unavailable.
    }
  }

  function openDeleteAccount() {
    window.open("https://www.yenkasa.xyz/delete-account", "_blank", "noopener,noreferrer");
  }

  function openModeration() {
    const token = getToken();
    const url = token
      ? `https://www.yenkasa.xyz/moderation?token=${encodeURIComponent(token)}`
      : "https://www.yenkasa.xyz/moderation";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <button
            type="button"
            className="settings-header__back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>
          <div>
            <h1>{t("settings")}</h1>
            <p>{t("manageAccountPreferences")}</p>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {loading ? <div className="settings-loading">{t("loadingSettings")}</div> : null}

        {!loading ? (
          <>
            <section className="settings-card">
              <h2>{t("privacy")}</h2>
              <SettingsSelectRow
                icon="◉"
                title={t("messagePrivacy")}
                description={privacyLabel(privacyLevel, t)}
                value={privacyLevel}
                disabled={busyKey === "privacy"}
                options={privacyOptions}
                onChange={handlePrivacyChange}
              />
            </section>

            <section className="settings-card">
              <h2>{t("language")}</h2>
              <SettingsSelectRow
                icon="Aa"
                title={t("language")}
                description={languageLabel || t("languageSummary")}
                value={language}
                options={languageOptions}
                onChange={handleLanguageChange}
              />
            </section>

            <section className="settings-card">
              <h2>{t("blockManagement")}</h2>
              <SettingsLinkRow
                icon="⊘"
                title="Who You Blocked"
                description="View users you have blocked"
                meta={`${counts.blockedUsers}`}
                onClick={() => navigate("/contacts")}
              />
              <SettingsLinkRow
                icon="⚠"
                title="Who Blocked You"
                description="View users who blocked you"
                meta={`${counts.blockedBy}`}
                onClick={() => navigate("/contacts")}
              />
            </section>

            <section className="settings-card">
              <h2>{t("postVisibility")}</h2>
              <SettingsLinkRow
                icon="◎"
                title="Community Visibility"
                description="Manage which communities can see your posts"
                meta={`${counts.communities}`}
                onClick={() => navigate("/communities")}
              />
              <SettingsLinkRow
                icon="◫"
                title="Blocked Communities"
                description="Communities you hid your posts from"
                meta="Manage"
                onClick={() => navigate("/communities")}
              />
              <SettingsLinkRow
                icon="◌"
                title="Users Hidden From Posts"
                description="People you prevented from seeing posts"
                meta={`${counts.hiddenUsers}`}
                onClick={() => navigate("/contacts")}
              />
            </section>

            <section className="settings-card">
              <h2>{t("notifications")}</h2>
              <SettingsSelectRow
                icon="♪"
                title={t("notificationSound")}
                description={soundLabel(soundId, t)}
                value={soundId}
                options={soundOptions}
                onChange={handleSoundChange}
              />
              <SettingsToggleRow
                icon="🔔"
                title={t("enableNotifications")}
                description={t("enableNotificationsDescription", "Manage your notification preferences")}
                checked={inAppEnabled}
                disabled={busyKey === "inAppEnabled"}
                onChange={(next) => handleNotificationsChange("inAppEnabled", next)}
              />
              <SettingsToggleRow
                icon="◈"
                title={t("rewardNotifications")}
                description={t("rewardNotificationsSettingDescription", "Mute wallet reward alerts only")}
                checked={rewardEnabled}
                disabled={busyKey === "rewardEnabled" || !inAppEnabled}
                onChange={(next) => handleNotificationsChange("rewardEnabled", next)}
              />
              {browserPermission !== "unsupported" ? (
                <SettingsLinkRow
                  icon="!"
                  title={t("browserAlerts", "Browser Alerts")}
                  description={browserNotificationDescription(t, browserPermission)}
                  meta={browserNotificationMeta(t, browserPermission)}
                  onClick={handleBrowserNotificationPermission}
                />
              ) : null}
            </section>

            {canAccessAdmin ? (
              <section className="settings-card">
                <h2>Moderation</h2>
                <SettingsLinkRow
                  icon="▣"
                  title="Moderation Dashboard"
                  description="Open the Yenkasa moderation workspace"
                  meta="Open"
                  onClick={openModeration}
                />
              </section>
            ) : null}

            <section className="settings-card settings-card--danger">
              <h2>Account</h2>
              <SettingsLinkRow
                icon="⇢"
                title="Delete Account & Data"
                description="Permanently remove your Yenkasa account and data"
                meta="Open"
                danger
                onClick={openDeleteAccount}
              />
            </section>
          </>
        ) : null}
      </div>
      <ChatSectionNav />
    </main>
  );
}

function SettingsLinkRow({ icon, title, description, meta, onClick, danger = false }) {
  return (
    <button
      type="button"
      className={`settings-row settings-row--button${danger ? " is-danger" : ""}`}
      onClick={onClick}
    >
      <span className="settings-row__icon">{icon}</span>
      <span className="settings-row__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="settings-row__meta">
        {meta}
        <i>›</i>
      </span>
    </button>
  );
}

function SettingsToggleRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}) {
  return (
    <div className={`settings-row${disabled ? " is-disabled" : ""}`}>
      <span className="settings-row__icon">{icon}</span>
      <span className="settings-row__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        className={`settings-switch${checked ? " is-on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span />
      </button>
    </div>
  );
}

function SettingsSelectRow({
  icon,
  title,
  description,
  value,
  options,
  onChange,
  disabled = false,
}) {
  return (
    <label className={`settings-row settings-row--select${disabled ? " is-disabled" : ""}`}>
      <span className="settings-row__icon">{icon}</span>
      <span className="settings-row__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="settings-select-wrap">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value || option.id} value={option.value || option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function privacyLabel(value, t) {
  const option = PRIVACY_OPTIONS.find((item) => item.value === value);
  return option ? t(option.labelKey) : t("messageRequestsRequired");
}

function soundLabel(soundId, t) {
  const option = NOTIFICATION_SOUND_OPTIONS.find((item) => item.id === soundId);
  return option ? t(option.labelKey) : t("notificationSoundDefault");
}

function browserNotificationMeta(t, permission) {
  if (permission === "unsupported") return "";
  if (permission === "granted") return t("allowed", "Allowed");
  if (permission === "denied") return t("blocked", "Blocked");
  return t("enable", "Enable");
}

function browserNotificationDescription(t, permission) {
  if (permission === "unsupported") {
    return t("browserAlertsUnsupported", "Browser alerts are not supported here.");
  }
  if (permission === "granted") {
    return t("browserAlertsAllowed", "Every new unread notification can appear on this device.");
  }
  if (permission === "denied") {
    return t("browserAlertsBlocked", "Allow notifications in your browser settings to receive alerts.");
  }
  return t("browserAlertsDescription", "Allow this browser to show incoming Yenkasa alerts.");
}
