import api from "./client";

export async function getVerificationDashboard() {
  const { data } = await api.get("/app-verification/dashboard");
  return data;
}

export async function getVerificationProgress() {
  const { data } = await api.get("/app-verification/progress");
  return data;
}
