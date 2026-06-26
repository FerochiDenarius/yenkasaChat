const screenshots = [
  {
    title: "Repository file retrieval",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-56-24-am.jpg",
  },
  {
    title: "Repository inventory and branch context",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-58-50-am.jpg",
  },
];

const videos = [
  "Screen Recording 2026-06-25 at 8.22.11 PM.mov",
  "Screen Recording 2026-06-25 at 8.24.06 PM.mov",
  "Screen Recording 2026-06-25 at 9.00.32 PM.mov",
  "Screen Recording 2026-06-25 at 9.04.07 PM.mov",
  "Screen Recording 2026-06-26 at 8.50.23 AM.mov",
  "Screen Recording 2026-06-26 at 8.57.25 AM.mov",
  "Screen Recording 2026-06-26 at 8.58.38 AM.mov",
  "Screen Recording 2026-06-26 at 9.00.26 AM.mov",
].map((name, index) => ({
  title: `YenkasaAI demo recording ${index + 1}`,
  src: `https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/${encodeURIComponent(name)}`,
}));

function mediaCard(item, type) {
  const article = document.createElement("article");
  article.className = "ai-media-card";
  const media = type === "video" ? document.createElement("video") : document.createElement("img");
  media.src = item.src;
  if (type === "video") {
    media.controls = true;
    media.preload = "metadata";
  } else {
    media.alt = item.title;
    media.loading = "lazy";
  }
  const body = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.title;
  const link = document.createElement("a");
  link.href = item.src;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = type === "video" ? "Open recording" : "Open screenshot";
  body.append(title, link);
  article.append(media, body);
  return article;
}

function renderGallery(id, items, type) {
  const target = document.getElementById(id);
  if (!target) return;
  target.replaceChildren(...items.map((item) => mediaCard(item, type)));
}

renderGallery("screenshotGallery", screenshots, "image");
renderGallery("videoGallery", videos, "video");
