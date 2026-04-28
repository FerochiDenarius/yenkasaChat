import api from "./client";

export async function getFeed(page = 1, limit = 10) {
  const { data } = await api.get("/feed", {
    params: { page, limit }
  });
  return data;
}

export async function toggleLike(postId) {
  const { data } = await api.post(`/social/like/${postId}`);
  return data;
}
