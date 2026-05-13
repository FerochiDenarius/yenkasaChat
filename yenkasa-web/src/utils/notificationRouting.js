export function resolveNotificationTarget(notification = {}) {
  const data = notification?.data || notification?.additionalData || {};
  const targetUrl = firstNotBlank(notification.targetUrl, data.targetUrl);
  const type = String(firstNotBlank(notification.type, data.type)).toLowerCase();
  const targetType = String(firstNotBlank(notification.targetType, data.targetType)).toLowerCase();
  const targetId = firstNotBlank(notification.targetId, data.targetId);
  const activityId = firstNotBlank(notification.activityId, data.activityId);
  const postId = firstNotBlank(notification.postId, data.postId);
  const commentId = firstNotBlank(notification.commentId, data.commentId);
  const roomId = firstNotBlank(data.roomId, data.chatId, targetType === "chat" ? targetId : null);
  const groupId = firstNotBlank(data.groupId, data.roomId, targetType === "group" ? targetId : null);

  const targetFromUrl = resolveTargetUrl(targetUrl);
  if (targetFromUrl) return targetFromUrl;

  if (type === "new_chat_message" || targetType === "chat") {
    return roomId ? `/chatrooms/${roomId}` : "/chatrooms";
  }

  if (type === "group_added" || targetType === "group") {
    return groupId ? `/chatrooms/${groupId}` : "/chatrooms";
  }

  if (targetType === "wallet" || type.startsWith("reward")) return "/wallet";
  if (targetType === "ad" || type === "ad_approved" || type === "ad_rejected") return "/ads";
  if (
    targetType === "community" ||
    type === "community_approved" ||
    type === "community_rejected"
  ) {
    return "/communities";
  }
  if (targetType === "approval" || type === "post_approved") return "/post-approvals";

  const resolvedPostId = firstNotBlank(
    postId,
    targetType === "post" ? targetId : null,
    ["comment", "like", "post_liked", "post_comment", "post_reply"].includes(type)
      ? activityId
      : null
  );

  if (targetType === "comment" || type.includes("comment")) {
    const commentPostId = firstNotBlank(resolvedPostId, activityId);
    return commentPostId
      ? `/post/${commentPostId}?openComments=true${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ""}`
      : "/notifications";
  }

  if (resolvedPostId || type.includes("like")) {
    return resolvedPostId ? `/post/${resolvedPostId}` : "/notifications";
  }

  if (targetType === "profile") {
    const profileId = firstNotBlank(targetId, activityId, notification.senderId, data.senderId);
    return profileId ? `/profile/${profileId}` : "/profile";
  }

  return "/notifications";
}

export function getNotificationId(notification = {}) {
  return firstNotBlank(
    notification.id,
    notification._id,
    notification.notificationId,
    notification.data?.notificationId
  );
}

function resolveTargetUrl(targetUrl) {
  if (!targetUrl) return "";
  try {
    const url = new URL(targetUrl, window.location.origin);
    const path = url.pathname;

    if (path.startsWith("/web/")) return path.replace(/^\/web/, "") + url.search;
    if (path.startsWith("/admin/post-approval")) return "/post-approvals";
    if (path === "/ads/mine") return "/ads";
    if (path === "/communities/mine") return "/communities";
    if (path.startsWith("/post/")) return path + url.search;
    if (path.startsWith("/profile/")) return path;
    if (path.startsWith("/chat/")) return path.replace(/^\/chat\//, "/chatrooms/");
    if (path.startsWith("/groups/")) return path.replace(/^\/groups\//, "/chatrooms/");
    if (path === "/wallet" || path.startsWith("/wallet/")) return "/wallet";
    if (path.startsWith("/")) return path + url.search;
  } catch {
    if (String(targetUrl).startsWith("/")) return targetUrl;
  }
  return "";
}

function firstNotBlank(...values) {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .find(Boolean) || "";
}

