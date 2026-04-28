import api from "./client";

export async function getAdsFeed() {
  const { data } = await api.get("/ads/feed");
  return data;
}

export async function getMyAds() {
  const { data } = await api.get("/ads/mine");
  return data;
}
