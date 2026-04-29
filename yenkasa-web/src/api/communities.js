import api from "./client";

export async function getCommunities(params = {}) {
  const { data } = await api.get("/communities/public", { params });
  return data;
}

export async function getMyCommunities() {
  const { data } = await api.get("/communities/user/my-communities");
  return data;
}

export async function getPrimaryCommunity() {
  const { data } = await api.get("/communities/user/community");
  return data;
}

export async function getJoinedCommunities() {
  const { data } = await api.get("/communities/user/joined-communities");
  return data;
}

export async function joinCommunity(communityId) {
  const { data } = await api.post(`/communities/${communityId}/join`);
  return data;
}

export async function leaveCommunity(communityId) {
  const { data } = await api.post(`/communities/${communityId}/leave`);
  return data;
}
