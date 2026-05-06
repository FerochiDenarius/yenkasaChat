import api from "./client";

export async function getAdminEconomySummary() {
  const { data } = await api.get("/admin/economy-summary");
  return data?.summary || data;
}

export async function getAdminTopCreators(limit = 12) {
  const { data } = await api.get("/admin/top-creators", { params: { limit } });
  return data?.creators || data?.topCreators || [];
}

export async function getAdminFraudAlerts(limit = 10) {
  const { data } = await api.get("/admin/fraud-alerts", { params: { limit } });
  return data?.alerts || data?.suspiciousUsers || [];
}
