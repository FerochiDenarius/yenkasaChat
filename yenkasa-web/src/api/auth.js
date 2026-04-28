import api from "./client";

export async function loginRequest(payload) {
  const { data } = await api.post("/login", payload);
  return data;
}

export async function registerRequest(payload) {
  const { data } = await api.post("/register", payload);
  return data;
}
