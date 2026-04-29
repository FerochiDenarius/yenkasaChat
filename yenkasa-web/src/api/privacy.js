import api from "./client";

export async function getPrivacy() {
  const { data } = await api.get("/user-privacy/get");
  return data || {};
}

export async function setPrivacyLevel(privacyLevel) {
  const { data } = await api.put("/user-privacy/set-privacy", { privacyLevel });
  return data;
}

export async function getBlockedUsers() {
  const { data } = await api.get("/user-privacy/blocked-users");
  return Array.isArray(data) ? data : [];
}

export async function getWhoBlockedYou() {
  const { data } = await api.get("/user-privacy/who-blocked-you");
  return Array.isArray(data) ? data : [];
}

export async function getCommunityVisibility() {
  const { data } = await api.get("/user-privacy/community-visibility");
  return Array.isArray(data) ? data : [];
}

export async function getHiddenUsers() {
  const { data } = await api.get("/user-privacy/hidden-users");
  return Array.isArray(data) ? data : [];
}
