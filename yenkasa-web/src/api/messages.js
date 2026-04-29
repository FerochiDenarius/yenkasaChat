import api from "./client";

export async function getRoomMessages(roomId) {
  const { data } = await api.get(`/messages/${roomId}`);
  return Array.isArray(data) ? data : [];
}

export async function sendRoomMessage(payload) {
  const { data } = await api.post("/messages", payload);
  return data;
}

export async function uploadRoomMedia(file, type = "file") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const { data } = await api.post("/messages/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function markRoomAsRead(roomId) {
  const { data } = await api.post(`/messages/${roomId}/mark-as-read`);
  return data;
}
