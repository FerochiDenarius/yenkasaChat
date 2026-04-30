const slug = window.location.pathname.split("/").filter(Boolean).pop();

function updateEngagementCount(id, value) {
  const node = document.getElementById(id);
  if (!node) return;
  node.innerText = Number(value || 0).toLocaleString();
}

fetch(`/api/blog/${slug}/views`)
  .then(res => res.json())
  .then(data => updateEngagementCount("viewCount", data.views))
  .catch(() => updateEngagementCount("viewCount", 0));

fetch(`/api/blog/${slug}/likes`)
  .then(res => res.json())
  .then(data => updateEngagementCount("likeCount", data.likes))
  .catch(() => updateEngagementCount("likeCount", 0));

fetch(`/api/blog/${slug}/view`, { method: "POST" })
  .then(res => res.json())
  .then(data => updateEngagementCount("viewCount", data.views))
  .catch(() => {});

function likePost() {
  fetch(`/api/blog/${slug}/like`, { method: "POST" })
    .then(res => res.json())
    .then(data => updateEngagementCount("likeCount", data.likes))
    .catch(() => {
      const count = document.getElementById("likeCount");
      if (!count) return;
      count.innerText = Number(count.innerText.replace(/,/g, "") || 0) + 1;
    });
}
