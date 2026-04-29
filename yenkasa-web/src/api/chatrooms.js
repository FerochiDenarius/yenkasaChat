import api from "./client";

export async function getChatRooms() {
  const { data } = await api.get("/chatrooms");
  return Array.isArray(data) ? data : [];
}

export async function createChatRoom(username) {
  const { data } = await api.post("/chatrooms", { username });
  return data;
}

export async function getChatRoom(roomId) {
  const { data } = await api.get(`/chatrooms/${roomId}`);
  return data;
}

export async function getChatRoomReceiver(roomId) {
  const { data } = await api.get(`/chatrooms/${roomId}/receiver`);
  return data;
}
