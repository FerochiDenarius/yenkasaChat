import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatSectionNav from "../components/chat/ChatSectionNav";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../api/notifications";
import {
  getBlockedUsers,
  getCommunityVisibility,
  getHiddenUsers,
  getPrivacy,
  getWhoBlockedYou,
  setPrivacyLevel,
} from "../api/privacy";
import { getStoredUser } from "../utils/storage";
import { canAccessAdminFeatures } from "../utils/roles";
import "../styles/settings.css";

const SOUND_OPTIONS = [
  { id: "sound_off", label: "Off" },
  { id: "sound_default", label: "Default" },
  { id: "sound_chime", label: "Chime" },
  { id: "sound_bell", label: "Bell" },
  { id: "sound_soft", label: "Soft" },
  { id: "sound_alert", label: "Alert" },
];

const PRIVACY_OPTIONS = [
  { value: "everyone", label: "Everyone can message you" },
  { value: "community_members", label: "Community members can message you" },
  { value: "requires_approval", label: "Message requests required" },
  { value: "nobody", label: "No one can message you" },
];

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [privacyLevel, setPrivacy] = useState("requires_approval");
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [rewardEnabled, setRewardEnabled] = useState(true);
  const [soundId, setSoundId] = useState(loadSoundPreference);
  const [counts, setCounts] = useState({
    blockedUsers: 0,
    blockedBy: 0,
    communities: 0,
    hiddenUsers: 0,
  });
  const [busyKey, setBusyKey] = useState("");

  const canAccessAdmin = useMemo(() => canAccessAdminFeatures(getStoredUser()), []);

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
            "Failed to load settings."
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
          "Failed to save privacy setting."
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
          "Failed to update notification settings."
      );
    } finally {
      setBusyKey("");
    }
  }

  function handleSoundChange(nextSoundId) {
    setSoundId(nextSoundId);
    window.localStorage.setItem("yenkasa_notification_sound", nextSoundId);
  }

  function openDeleteAccount() {
    window.open("https://www.yenkasa.xyz/delete-account", "_blank", "noopener,noreferrer");
  }

  function openModeration() {
    window.open("https://www.yenkasa.xyz/moderation", "_blank", "noopener,noreferrer");
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
            <h1>Settings</h1>
            <p>Manage your account and preferences</p>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {loading ? <div className="settings-loading">Loading settings...</div> : null}

        {!loading ? (
          <>
            <section className="settings-card">
              <h2>Privacy</h2>
              <SettingsSelectRow
                icon="◉"
                title="Message Privacy"
                description={privacyLabel(privacyLevel)}
                value={privacyLevel}
                disabled={busyKey === "privacy"}
                options={PRIVACY_OPTIONS}
                onChange={handlePrivacyChange}
              />
            </section>

            <section className="settings-card">
              <h2>Block Management</h2>
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
              <h2>Post Visibility</h2>
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
              <h2>Notifications</h2>
              <SettingsSelectRow
                icon="♪"
                title="Notification Sound"
                description={soundLabel(soundId)}
                value={soundId}
                options={SOUND_OPTIONS}
                onChange={handleSoundChange}
              />
              <SettingsToggleRow
                icon="🔔"
                title="Enable Notifications"
                description="Manage your notification preferences"
                checked={inAppEnabled}
                disabled={busyKey === "inAppEnabled"}
                onChange={(next) => handleNotificationsChange("inAppEnabled", next)}
              />
              <SettingsToggleRow
                icon="◈"
                title="Reward Notifications"
                description="Mute wallet reward alerts only"
                checked={rewardEnabled}
                disabled={busyKey === "rewardEnabled" || !inAppEnabled}
                onChange={(next) => handleNotificationsChange("rewardEnabled", next)}
              />
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

function privacyLabel(value) {
  return (
    PRIVACY_OPTIONS.find((option) => option.value === value)?.label ||
    "Message requests required"
  );
}

function soundLabel(soundId) {
  return (
    SOUND_OPTIONS.find((option) => option.id === soundId)?.label ||
    "Default"
  );
}

function loadSoundPreference() {
  return window.localStorage.getItem("yenkasa_notification_sound") || "sound_default";
}
