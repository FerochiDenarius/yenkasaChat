(function () {
  const SETTINGS_URL = "/triciabales-api/api/store-profile";
  const FALLBACK_LOGO = "/store/assets/images/YenkasaStoreLogo.png";
  const FALLBACK_LOGO_VERSION = "20260814-store-logo";

  function versionLocalLogoUrl(logoUrl) {
    const value = String(logoUrl || "").trim() || FALLBACK_LOGO;

    if (!value.startsWith("/store/assets/images/YenkasaStoreLogo.png")) {
      return value;
    }

    const separator = value.includes("?") ? "&" : "?";
    return value.includes("v=") ? value : `${value}${separator}v=${FALLBACK_LOGO_VERSION}`;
  }

  function updateLogos(profile) {
    const logoUrl = versionLocalLogoUrl(profile?.logoUrl);

    document
      .querySelectorAll('img[alt*="Yenkasa Store logo"], img[data-store-logo]')
      .forEach((image) => {
        image.src = logoUrl;
        image.dataset.storeLogo = "true";
      });
  }

  function updateAnnouncement(profile) {
    const announcement = document.querySelector("[data-store-announcement]");
    if (!announcement) {
      return;
    }

    const isVisible = Boolean(profile?.announcementEnabled && profile?.announcementText);
    announcement.classList.toggle("hidden", !isVisible);

    if (!isVisible) {
      return;
    }

    announcement.replaceChildren();

    const inner = document.createElement("div");
    const title = document.createElement("span");
    const message = document.createElement("p");

    inner.className = "store-announcement-inner";
    title.textContent = profile.announcementTitle || "Store Update";
    message.textContent = profile.announcementText;

    inner.append(title, message);
    announcement.append(inner);
  }

  async function loadStoreSettings() {
    try {
      const response = await fetch(SETTINGS_URL);
      if (!response.ok) {
        throw new Error("Store settings unavailable");
      }

      const profile = await response.json();
      updateLogos(profile);
      updateAnnouncement(profile);

      window.yenkasaStoreProfile = profile;
      window.dispatchEvent(new CustomEvent("yenkasa-store-profile-loaded", {
        detail: profile
      }));
    } catch (error) {
      console.warn("[Yenkasa Store] Could not load store profile", error);
      updateLogos({ logoUrl: FALLBACK_LOGO });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadStoreSettings);
  } else {
    loadStoreSettings();
  }
})();
