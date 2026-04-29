import { CLOUDINARY_STATIC_IMAGES } from "../config/cloudinaryStaticAssets";

const STATIC_IMAGE_ALIASES = {
  "yenkasa_web_assets/yenkasa_logo.png": "logo.png",
  "yenkasa_logo.png": "logo.png",
  "coin.png": "ykc.png",
  "ykc-coin.png": "ykc.png",
  "verification-badge.png": "verified.png",
  "badge_verified.png": "verified.png",
  "badge_admin.png": "admin.png",
  "badge_moderator.png": "moderator.png",
};

function normalizeStaticImageName(name) {
  const cleanName = String(name || "default.png").replace(/^\/?images\//, "");
  return STATIC_IMAGE_ALIASES[cleanName] || cleanName;
}

export function staticImage(name) {
  const normalizedName = normalizeStaticImageName(name);
  return CLOUDINARY_STATIC_IMAGES[normalizedName] || `/images/${normalizedName}`;
}

export function staticImageFallback(name) {
  const normalizedName = normalizeStaticImageName(name);
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/?$/, "/")}images/${normalizedName}`;
}

export function handleStaticImageError(event, name) {
  const fallback = staticImageFallback(name);
  const current = event.currentTarget?.src || "";
  if (current.endsWith(fallback)) {
    const defaultFallback = staticImageFallback("default.png");
    if (!current.endsWith(defaultFallback)) {
      event.currentTarget.src = defaultFallback;
    }
    return;
  }
  event.currentTarget.src = fallback;
}

export function handleDynamicImageError(event) {
  handleStaticImageError(event, "default.png");
}
