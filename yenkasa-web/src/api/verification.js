import api from "./client";

export async function getVerificationDashboard() {
  const { data } = await api.get("/app-verification/dashboard");
  return data;
}

export async function getVerificationProgress() {
  const { data } = await api.get("/app-verification/progress");
  return data;
}

export async function trackAdView() {
  const { data } = await api.post("/app-verification/track-ad-view");
  return data;
}

export async function requestEmailVerification() {
  const { data } = await api.post("/email-verification/request");
  return data;
}

export async function confirmEmailVerification(code) {
  const { data } = await api.post("/email-verification/confirm", { code });
  return data;
}
