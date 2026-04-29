export const WALLET_REFRESH_EVENT = "yenkasa:wallet-refresh";

export function requestWalletRefresh(reason = "activity") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_REFRESH_EVENT, { detail: { reason } }));
}
