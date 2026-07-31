import api from "./client";

export async function createPost(payload) {
  const hasFiles =
    payload.images?.length ||
    payload.video ||
    payload.audio;

  if (!hasFiles) {
    const { data } = await api.post("/posts", {
      text: payload.text,
      communityId: payload.communityId,
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
  formData.append("communityId", payload.communityId || "");
  formData.append("communityName", payload.communityName || "");
  formData.append("visibility", payload.visibility || "public");
  formData.append("postType", payload.postType || "text");
  formData.append("textBackgroundColor", payload.textBackgroundColor || "");
  formData.append("location", payload.location || "");

  (payload.tags || []).forEach((tag) => formData.append("tags[]", tag));
  (payload.images || []).forEach((file) => formData.append("imageUrl", file));
  if (payload.video) {
    formData.append("videoUrl", payload.video);
    const thumbnail = payload.thumbnail || await createVideoThumbnail(payload.video);
    if (thumbnail) {
      formData.append("thumbnail", thumbnail, thumbnail.name || "video-thumbnail.jpg");
    }
  }
  if (payload.audio) formData.append("audioUrl", payload.audio);

  const { data } = await api.post("/posts", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

async function createVideoThumbnail(videoFile) {
  if (typeof document === "undefined" || !videoFile?.type?.startsWith("video/")) return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    const finish = (file) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file || null);
    };

    const capture = () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const maxWidth = 1280;
        const scale = Math.min(1, maxWidth / Math.max(width, 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          finish(null);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              finish(null);
              return;
            }
            finish(new File([blob], "video-thumbnail.jpg", { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.82
        );
      } catch {
        finish(null);
      }
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onerror = () => finish(null);
    video.onseeked = capture;
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const targetTime = duration > 2 ? 1 : Math.max(0, duration / 2);
      if (targetTime > 0) {
        video.currentTime = targetTime;
      } else {
        capture();
      }
    };
    timeoutId = window.setTimeout(() => finish(null), 5000);
    video.src = objectUrl;
    video.load();
  });
}
