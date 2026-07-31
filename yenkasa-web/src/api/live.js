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

export async function getActiveLivestreams(limit = 30) {
  const { data } = await api.get("/livestream/active", {
    params: { limit }
  });
  return data;
}

export async function joinLivestream(streamId, role = "audience") {
  const { data } = await api.post(`/livestream/join/${streamId}`, { role });
  return data;
}

export async function giftLivestream(streamId, giftKey) {
  const { data } = await api.post("/livestream/gift", { streamId, giftKey });
  return data;
}

export async function getLivestreamMetrics(streamId) {
  const { data } = await api.get(`/livestream/${streamId}/metrics`);
  return data;
}
