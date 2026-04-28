import api from "./client";

export async function createPost(payload) {
  const hasFiles =
    payload.images?.length ||
    payload.video ||
    payload.audio;

  if (!hasFiles) {
    const { data } = await api.post("/posts", {
      text: payload.text,
      communityName: payload.communityName,
      visibility: payload.visibility,
      postType: payload.postType || "text",
      textBackgroundColor: payload.textBackgroundColor,
      location: payload.location || "",
      tags: payload.tags || [],
    });
    return data;
  }

  const formData = new FormData();
  formData.append("text", payload.text || "");
  formData.append("communityName", payload.communityName || "");
  formData.append("visibility", payload.visibility || "public");
  formData.append("postType", payload.postType || "text");
  formData.append("textBackgroundColor", payload.textBackgroundColor || "");
  formData.append("location", payload.location || "");

  (payload.tags || []).forEach((tag) => formData.append("tags[]", tag));
  (payload.images || []).forEach((file) => formData.append("imageUrl", file));
  if (payload.video) formData.append("videoUrl", payload.video);
  if (payload.audio) formData.append("audioUrl", payload.audio);

  const { data } = await api.post("/posts", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
