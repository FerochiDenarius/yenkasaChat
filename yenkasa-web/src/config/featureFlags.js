const rawPlayerFeedFlag =
  import.meta.env.VITE_USE_YENKASA_WEB_PLAYERVIEW_FEED ??
  import.meta.env.USE_YENKASA_WEB_PLAYERVIEW_FEED;

export const USE_YENKASA_WEB_PLAYERVIEW_FEED =
  rawPlayerFeedFlag === undefined ? true : String(rawPlayerFeedFlag).toLowerCase() !== "false";
