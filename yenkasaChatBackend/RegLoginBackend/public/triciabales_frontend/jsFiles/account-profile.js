const accountProfileForm = document.getElementById("accountProfileForm");
const accountProfileFeedback = document.getElementById("accountProfileFeedback");
const accountProfileImageInput = document.getElementById("profileImage");
const accountProfilePreview = document.getElementById("profilePreview");

function getStoredUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "null");
}

function getStoredToken() {
  return localStorage.getItem("authToken") || "";
}

function getInitials(name, email) {
  const source = (name || email || "YS").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("") || "YS";
}

function setProfileFeedback(message, type = "info") {
  if (!accountProfileFeedback) return;
  accountProfileFeedback.textContent = message;
  accountProfileFeedback.className = `profile-feedback ${type}`;
}

function renderProfileAvatar(user) {
  if (!accountProfilePreview) return;

  if (user?.profileImageUrl) {
    accountProfilePreview.innerHTML = `<img src="${user.profileImageUrl}" alt="${user.name || "Profile picture"}">`;
    return;
  }

  accountProfilePreview.innerHTML = `<span>${getInitials(user?.name, user?.email)}</span>`;
}

function hydrateProfileForm(user) {
  if (!accountProfileForm || !user) return;

  document.getElementById("profileName").value = user.name || "";
  document.getElementById("profileEmail").value = user.email || "";
  document.getElementById("profilePhone").value = user.phone || "";
  document.getElementById("profileAddress").value = user.address || "";
  document.getElementById("profilePassword").value = "";
  renderProfileAvatar(user);
}

function updateVisibleProfile(user) {
  document.querySelectorAll("[data-profile-name]").forEach(element => {
    element.textContent = user?.name || "Account";
  });

  document.querySelectorAll("[data-profile-email]").forEach(element => {
    element.textContent = user?.email || "";
  });

  if (typeof window.updateCurrentUserFromProfile === "function") {
    window.updateCurrentUserFromProfile(user);
  }
}

async function loadFreshProfile() {
  const token = getStoredToken();

  if (!accountProfileForm) return;

  if (!token) {
    accountProfileForm.closest(".account-profile-card, .card")?.classList.add("hidden-panel");
    return;
  }

  try {
    const response = await fetch("/triciabales-api/api/users/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const user = await response.json();

    if (!response.ok) {
      throw new Error(user.message || user.error || "Could not load profile");
    }

    localStorage.setItem("currentUser", JSON.stringify(user));
    hydrateProfileForm(user);
    updateVisibleProfile(user);
  } catch (err) {
    console.error("[Yenkasa Store] Could not load profile", err);
    hydrateProfileForm(getStoredUser());
  }
}

accountProfileImageInput?.addEventListener("change", () => {
  const file = accountProfileImageInput.files?.[0];

  if (!file) {
    renderProfileAvatar(getStoredUser());
    return;
  }

  accountProfilePreview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="New profile picture">`;
});

accountProfileForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const token = getStoredToken();
  const submitButton = accountProfileForm.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  const formData = new FormData();

  formData.append("name", document.getElementById("profileName").value.trim());
  formData.append("email", document.getElementById("profileEmail").value.trim());
  formData.append("phone", document.getElementById("profilePhone").value.trim());
  formData.append("address", document.getElementById("profileAddress").value.trim());

  const password = document.getElementById("profilePassword").value;
  if (password) {
    formData.append("password", password);
  }

  if (accountProfileImageInput.files?.[0]) {
    formData.append("profileImage", accountProfileImageInput.files[0]);
  }

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Saving profile...";
    setProfileFeedback("Saving profile...", "info");

    const response = await fetch("/triciabales-api/api/users/me", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not update profile");
    }

    localStorage.setItem("currentUser", JSON.stringify(data.user));
    hydrateProfileForm(data.user);
    updateVisibleProfile(data.user);
    setProfileFeedback(data.message || "Profile updated successfully.", "success");

    if (data.actionUrl) {
      alert(`${data.message}\n\nVerification link:\n${data.actionUrl}`);
    }
  } catch (err) {
    console.error("[Yenkasa Store] Profile update failed", err);
    setProfileFeedback(err.message || "Could not update profile.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});

loadFreshProfile();
