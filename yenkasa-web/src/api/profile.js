import api from "./client";

export async function getProfile() {
  const { data } = await api.get("/profile");
  return data;
}

export async function getUserProfile(userId) {
  if (userId) {
    const { data } = await api.get(`/profile/users/${userId}/profile`);
    return data;
  }

  const { data } = await api.get("/users/me");
  return data;
}

export async function followUser(userId) {
  const { data } = await api.post(`/follow/${userId}/follow`);
  return data;
}

export async function unfollowUser(userId) {
  const { data } = await api.post(`/follow/${userId}/unfollow`);
  return data;
}

export async function updateUserProfile(payload) {
  const { data } = await api.put("/users/profile", payload);
  return data;
}

export async function uploadProfilePicture(file) {
  const formData = new FormData();
  formData.append("profileImage", file);
  const { data } = await api.post("/users/profile-picture", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function changePassword(payload) {
  const { data } = await api.put("/users/change-password", payload);
  return data;
}
