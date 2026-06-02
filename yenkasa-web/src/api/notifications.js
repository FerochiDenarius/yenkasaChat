import api from "./client";

export async function getNotifications() {
  const { data } = await api.get("/notifications/all");
  return Array.isArray(data) ? data : [];
}

export async function getNotificationPreferences() {
  const { data } = await api.get("/notifications/preferences");
  return data?.preferences || {};
}

export async function updateNotificationPreferences(payload) {
  const { data } = await api.put("/notifications/preferences", payload);
  return data?.preferences || {};
}

export async function markNotificationRead(notificationId, interaction = "opened") {
  const { data } = await api.put(`/notifications/${notificationId}/read`, null, {
    params: { interaction },
  });
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.put("/notifications/read-all");
  return data;
}
