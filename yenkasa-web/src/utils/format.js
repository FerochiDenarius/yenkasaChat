export function getAuthorName(post) {
  return (
    post?.userId?.username ||
    post?.username ||
    post?.author?.username ||
    "Yenkasa User"
  );
}

export function buildMediaUrl(item) {
  return (
    item?.imageUrl ||
    item?.mediaUrl ||
    item?.thumbnail ||
    item?.photoUrl ||
    item?.image ||
    null
  );
}

export function formatRelativeTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

export function readableRank(rank) {
  if (!rank) return "Unverified";
  return rank
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
