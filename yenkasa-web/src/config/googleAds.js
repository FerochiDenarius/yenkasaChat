export const GOOGLE_ADS_CONFIG = {
  client:
    import.meta.env.VITE_GOOGLE_AD_CLIENT ||
    import.meta.env.VITE_GOOGLE_ADS_CLIENT ||
    import.meta.env.VITE_ADSENSE_CLIENT ||
    "",
  feedSlot:
    import.meta.env.VITE_GOOGLE_FEED_AD_SLOT ||
    import.meta.env.VITE_GOOGLE_AD_SLOT_FEED ||
    import.meta.env.VITE_ADSENSE_FEED_SLOT ||
    "",
  feedFormat: import.meta.env.VITE_GOOGLE_FEED_AD_FORMAT || "auto",
  fullWidthResponsive:
    import.meta.env.VITE_GOOGLE_AD_FULL_WIDTH_RESPONSIVE === "false"
      ? "false"
      : "true",
};

export function hasGoogleFeedAdConfig() {
  return Boolean(GOOGLE_ADS_CONFIG.client && GOOGLE_ADS_CONFIG.feedSlot);
}
