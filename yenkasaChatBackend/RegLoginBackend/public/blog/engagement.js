(function () {
  const engagement = document.getElementById("engagement");
  if (!engagement) return;

  const rawSlug = window.location.pathname.split("/").filter(Boolean).pop() || "";
  const slug = decodeURIComponent(rawSlug).replace(/\.html$/i, "");
  const likeButton = engagement.querySelector("button");

  if (!slug || slug === "blog") return;

  function updateEngagementCount(id, value) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerText = Number(value || 0).toLocaleString();
  }

  function api(path, options) {
    return fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      ...options,
    }).then((res) => {
      if (!res.ok) throw new Error(`Blog engagement request failed: ${res.status}`);
      return res.json();
    });
  }

  function loadCounts() {
    api(`/api/blog/${slug}/views`)
      .then((data) => updateEngagementCount("viewCount", data.views))
      .catch(() => updateEngagementCount("viewCount", 0));

    api(`/api/blog/${slug}/likes`)
      .then((data) => updateEngagementCount("likeCount", data.likes))
      .catch(() => updateEngagementCount("likeCount", 0));
  }

  function recordView() {
    api(`/api/blog/${slug}/view`, { method: "POST" })
      .then((data) => updateEngagementCount("viewCount", data.views))
      .catch(() => {});
  }

  function likePost() {
    if (likeButton) {
      likeButton.disabled = true;
      likeButton.classList.add("is-loading");
    }

    api(`/api/blog/${slug}/like`, { method: "POST" })
      .then((data) => {
        updateEngagementCount("likeCount", data.likes);
        if (likeButton) likeButton.textContent = "Liked";
      })
      .catch(() => {
        if (likeButton) likeButton.textContent = "Try again";
      })
      .finally(() => {
        if (likeButton) {
          likeButton.disabled = false;
          likeButton.classList.remove("is-loading");
        }
      });
  }

  window.likePost = likePost;

  if (likeButton) {
    likeButton.type = "button";
    likeButton.classList.add("blog-like-button");
    likeButton.addEventListener("click", likePost);
  }

  loadCounts();
  recordView();
})();
