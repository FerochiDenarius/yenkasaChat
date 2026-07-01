const screenshotAssets = [];

const videoFiles = [
  ["Product Demo", "Screen Recording 2026-06-25 at 8.22.11\u202fPM.mov"],
  ["Architecture Demo", "Screen Recording 2026-06-25 at 8.24.06\u202fPM.mov"],
  ["Repository Demo", "Screen Recording 2026-06-25 at 9.00.32\u202fPM.mov"],
  ["Operational Intelligence Demo", "Screen Recording 2026-06-25 at 9.04.07\u202fPM.mov"],
  ["Engineering Demo", "Screen Recording 2026-06-26 at 8.57.25\u202fAM.mov"],
  ["Latest Product Walkthrough", "Screen Recording 2026-07-01 at 10.44.25\u202fAM.mov"],
  ["Latest Web Version Demo", "Screen Recording 2026-07-01 at 10.53.40\u202fAM.mov"],
];

const videoAssets = videoFiles.map(([category, name], index) => ({
  category,
  title: `${category} ${index + 1}`,
  src: `https://storage.googleapis.com/yenkasa-media/portfolio/yenkasa-ai/${encodeURIComponent(name)}`,
}));

function mediaCard(item, type) {
  const article = document.createElement("article");
  article.className = "ai-media-card";

  let media;

  if (type === "video") {
    media = document.createElement("video");
    media.src = item.src;
    media.controls = true;
    media.preload = "metadata";
    media.playsInline = true;
    media.setAttribute("aria-label", item.title);
  } else {
    media = document.createElement("img");
    media.src = item.src;
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
  if (!target || target.dataset.rendered === "true") return;
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ai-gallery-placeholder";
    empty.textContent = "Final screenshot set reserved. Use the playable demos above for the current product walkthrough.";
    target.replaceChildren(empty);
  } else {
    target.replaceChildren(...items.map((item) => mediaCard(item, type)));
  }
  target.dataset.rendered = "true";
}

function renderWhenVisible(id, items, type) {
  const target = document.getElementById(id);
  if (!target) return;

  const placeholder = document.createElement("div");
  placeholder.className = "ai-gallery-placeholder";
  placeholder.textContent = "Gallery loads when this section enters view.";
  target.replaceChildren(placeholder);

  if (!("IntersectionObserver" in window)) {
    renderGallery(id, items, type);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      renderGallery(id, items, type);
    },
    { rootMargin: "260px" }
  );

  observer.observe(target);
}

renderWhenVisible("screenshotGallery", screenshotAssets, "image");
renderWhenVisible("videoGallery", videoAssets, "video");
