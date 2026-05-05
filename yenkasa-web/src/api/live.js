import api from "./client";

export async function getLiveMetrics(windowKey = "5m") {
  const { data } = await api.get("/live/metrics", {
    params: { window: windowKey }
  });
  return data;
}

export async function createLiveDuel(metricType = "comment") {
  const { data } = await api.post("/live/duel/create", { metricType });
  return data;
}

export async function joinLiveDuel(duelId) {
  const { data } = await api.post("/live/duel/join", { duelId });
  return data;
}

export async function getLiveEvents() {
  const { data } = await api.get("/live/events");
  return data;
}
