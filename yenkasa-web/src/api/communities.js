import api from "./client";

export async function getCommunities(params = {}) {
  const { data } = await api.get("/communities/public", { params });
  return data;
}

export async function getMyCommunities() {
  const { data } = await api.get("/communities/user/my-communities");
  return data;
}
