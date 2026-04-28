import api from "./client";

export async function getProfile() {
  const { data } = await api.get("/profile");
  return data;
}
