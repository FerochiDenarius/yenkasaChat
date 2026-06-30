const screenshotAssets = [
  {
    category: "Desktop",
    title: "Desktop intelligence workspace",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-56-24-am.jpg",
  },
  {
    category: "Web",
    title: "Web product interface",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-58-50-am.jpg",
  },
  {
    category: "AI Chat",
    title: "Evidence-based AI chat",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-56-24-am.jpg",
  },
  {
    category: "Repository Intelligence",
    title: "Repository file retrieval",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-58-50-am.jpg",
  },
  {
    category: "Operational Intelligence",
    title: "Operational intelligence workflow",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-56-24-am.jpg",
  },
  {
    category: "Dashboards",
    title: "Product intelligence dashboard",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-58-50-am.jpg",
  },
  {
    category: "Architecture",
    title: "Central intelligence architecture",
    src: "https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/screenshot-2026-06-26-at-8-56-24-am.jpg",
  },
];

const videoFiles = [
  ["Product Demo", "Screen Recording 2026-06-25 at 8.22.11\u202fPM.mov"],
  ["Architecture Demo", "Screen Recording 2026-06-25 at 8.24.06\u202fPM.mov"],
  ["Repository Demo", "Screen Recording 2026-06-25 at 9.00.32\u202fPM.mov"],
  ["Operational Intelligence Demo", "Screen Recording 2026-06-25 at 9.04.07\u202fPM.mov"],
  ["Engineering Demo", "Screen Recording 2026-06-26 at 8.50.23\u202fAM.mov"],
  ["Product Demo", "Screen Recording 2026-06-26 at 8.57.25\u202fAM.mov"],
  ["Repository Demo", "Screen Recording 2026-06-26 at 8.58.38\u202fAM.mov"],
  ["Engineering Demo", "Screen Recording 2026-06-26 at 9.00.26\u202fAM.mov"],
];

const videoAssets = videoFiles.map(([category, name], index) => ({
  category,
  title: `${category} ${index + 1}`,
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
    media.decoding = "async";
  }

  const body = document.createElement("div");
  const category = document.createElement("span");
  category.textContent = item.category;

  const title = document.createElement("strong");
  title.textContent = item.title;

  const link = document.createElement("a");
  link.href = item.src;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = type === "video" ? "Open recording" : "Open screenshot";

  body.append(category, title, link);
  article.append(media, body);
  return article;
}

function renderGallery(id, items, type) {
  const target = document.getElementById(id);
  if (!target) return;
  target.replaceChildren(...items.map((item) => mediaCard(item, type)));
}

renderGallery("screenshotGallery", screenshotAssets, "image");
renderGallery("videoGallery", videoAssets, "video");
