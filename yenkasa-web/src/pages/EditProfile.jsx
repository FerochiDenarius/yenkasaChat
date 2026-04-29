import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changePassword,
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
} from "../api/profile";
import { getStoredUser, updateStoredUser } from "../utils/storage";
import "../styles/edit-profile.css";

const EMPTY_FORM = {
  username: "",
  email: "",
  phoneNumber: "",
  location: "",
  gender: "",
  dateOfBirth: "",
};

export default function EditProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [form, setForm] = useState(() => normalizeUser(storedUser));
  const [profileImage, setProfileImage] = useState(
    storedUser?.profileImage || storedUser?.profilePicUrl || storedUser?.avatar || "/images/default.png"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const user = await getUserProfile();
        if (!active) return;
        setForm(normalizeUser(user));
        setProfileImage(user?.profileImage || "/images/default.png");
        updateStoredUser(user);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            "Profile could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => String(value || "").trim() !== "")
      );
      const response = await updateUserProfile(payload);
      const user = response?.user || payload;
      updateStoredUser(user);
      setForm((prev) => ({ ...prev, ...normalizeUser(user) }));
      setMessage("Profile updated");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleImageSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setMessage("");

    const localPreview = URL.createObjectURL(file);
    setProfileImage(localPreview);

    try {
      const response = await uploadProfilePicture(file);
      if (response?.imageUrl) {
        setProfileImage(response.imageUrl);
        updateStoredUser({ profileImage: response.imageUrl });
      }
      setMessage("Profile image updated");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Profile image upload failed."
      );
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
      event.target.value = "";
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (!passwordForm.oldPassword || passwordForm.newPassword.length < 6) {
      setError("Enter your current password and a new password of at least 6 characters.");
      return;
    }

    setChangingPassword(true);
    setError("");
    setMessage("");

    try {
      await changePassword(passwordForm);
      setMessage("Password updated");
      setPasswordForm({ oldPassword: "", newPassword: "" });
      setPasswordOpen(false);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Wrong current password."
      );
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <main className="edit-profile-page">
      <div className="edit-profile-shell">
        <header className="edit-profile-header">
          <button
            type="button"
            className="edit-profile-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            {"<"}
          </button>
          <div>
            <h1>Edit Profile</h1>
            <p>Update your personal information</p>
          </div>
        </header>

        <section className="edit-profile-identity">
          <div className="edit-profile-avatar-wrap">
            <img
              src={profileImage}
              alt={form.username || "Profile"}
              className="edit-profile-avatar"
              onError={(event) => {
                event.currentTarget.src = "/images/default.png";
              }}
            />
            <button
              type="button"
              className="edit-profile-camera"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile photo"
            >
              {uploading ? "..." : "CAM"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageSelected}
            />
          </div>
          <div className="edit-profile-name-row">
            <strong>{form.username || "Username"}</strong>
            <img src="/images/verified.png" alt="Verified" />
          </div>
          <span>{form.phoneNumber || "No phone number"}</span>
        </section>

        {error ? <div className="edit-profile-alert edit-profile-alert--error">{error}</div> : null}
        {message ? <div className="edit-profile-alert">{message}</div> : null}

        <form className="edit-profile-form" onSubmit={saveProfile}>
          <ProfileField
            icon="U"
            label="Username"
            value={form.username}
            onChange={(value) => updateField("username", value)}
            autoComplete="username"
          />
          <ProfileField
            icon="@"
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => updateField("email", value)}
            autoComplete="email"
          />
          <ProfileField
            icon="P"
            label="Phone"
            value={form.phoneNumber}
            onChange={(value) => updateField("phoneNumber", value)}
            autoComplete="tel"
          />
          <ProfileField
            icon="L"
            label="Location"
            value={form.location}
            onChange={(value) => updateField("location", value)}
            autoComplete="address-level2"
          />

          <label className="edit-profile-row">
            <span className="edit-profile-row__icon">G</span>
            <span className="edit-profile-row__body">
              <span>Gender</span>
              <select
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value)}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </span>
            <span className="edit-profile-row__chevron">v</span>
          </label>

          <ProfileField
            icon="D"
            label="Date of Birth"
            type="date"
            value={form.dateOfBirth}
            onChange={(value) => updateField("dateOfBirth", value)}
          />

          <button
            type="button"
            className="edit-profile-password-row"
            onClick={() => setPasswordOpen(true)}
          >
            <span className="edit-profile-row__icon edit-profile-row__icon--gold">PW</span>
            <span>
              <strong>Change Password</strong>
              <small>Update your account password</small>
            </span>
            <span>&gt;</span>
          </button>

          <button className="edit-profile-save" type="submit" disabled={saving || loading}>
            <span>{saving ? "Saving..." : "Save Changes"}</span>
            <strong>&gt;</strong>
          </button>
        </form>

        <footer className="edit-profile-secure">Your information is private and secure</footer>
      </div>

      {passwordOpen ? (
        <div className="edit-profile-modal" role="dialog" aria-modal="true">
          <form className="edit-profile-modal__card" onSubmit={submitPassword}>
            <h2>Change Password</h2>
            <label>
              <span>Current password</span>
              <input
                type="password"
                value={passwordForm.oldPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, oldPassword: event.target.value }))
                }
                autoComplete="current-password"
              />
            </label>
            <label>
              <span>New password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                autoComplete="new-password"
              />
            </label>
            <div className="edit-profile-modal__actions">
              <button type="button" onClick={() => setPasswordOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={changingPassword}>
                {changingPassword ? "Updating..." : "Update"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function ProfileField({ icon, label, value, onChange, type = "text", autoComplete }) {
  return (
    <label className="edit-profile-row">
      <span className="edit-profile-row__icon">{icon}</span>
      <span className="edit-profile-row__body">
        <span>{label}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
      </span>
      <span className="edit-profile-row__chevron">{type === "date" ? "[]" : ">"}</span>
    </label>
  );
}

function normalizeUser(user) {
  return {
    ...EMPTY_FORM,
    username: user?.username || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || user?.phone || "",
    location: user?.location || "",
    gender: user?.gender || "",
    dateOfBirth: user?.dateOfBirth || "",
  };
}
