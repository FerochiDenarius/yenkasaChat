const API_BASE = "https://www.yenkasa.xyz/triciabales-api";
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken");

const notificationsTitle = document.getElementById("notificationsTitle");
const notificationsSubtitle = document.getElementById("notificationsSubtitle");
const notificationCountTitle = document.getElementById("notificationCountTitle");
const notificationCountText = document.getElementById("notificationCountText");
const notificationsFeedback = document.getElementById("notificationsFeedback");
const notificationsList = document.getElementById("notificationsList");
const refreshNotificationsBtn = document.getElementById("refreshNotificationsBtn");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const buyerOrdersLink = document.getElementById("buyerOrdersLink");
const sellerDashboardLink = document.getElementById("sellerDashboardLink");
const superAdminLink = document.getElementById("superAdminLink");

let loadedNotifications = [];

function showFeedback(message, type = "info") {
  if (!notificationsFeedback) return;

  notificationsFeedback.textContent = message;
  notificationsFeedback.className = `orders-feedback ${type}`;
  notificationsFeedback.classList.remove("hidden");
}

function clearFeedback() {
  notificationsFeedback?.classList.add("hidden");
}

function requireLogin() {
  if (!currentUser || !authToken) {
    showFeedback("Please login before viewing notifications.", "error");
    setTimeout(() => {
      window.location.href = "/store/buyer-login";
    }, 900);
    return false;
  }

  return true;
}

function applyRoleUi() {
  const role = String(currentUser?.role || "").toUpperCase();
  const name = currentUser?.name || "your account";

  notificationsTitle.textContent = `${name} Notifications`;

  if (role === "SUPER_ADMIN") {
    notificationsSubtitle.textContent = "Platform-wide notices for orders, payments, payouts and sensitive admin activity.";
    buyerOrdersLink?.classList.add("hidden-nav-link");
    sellerDashboardLink?.classList.add("hidden-nav-link");
    return;
  }

  if (role === "SELLER") {
    notificationsSubtitle.textContent = "Seller alerts for new orders, payment confirmations, delivery updates and account activity.";
    buyerOrdersLink?.classList.add("hidden-nav-link");
    superAdminLink?.classList.add("hidden-nav-link");
    return;
  }

  notificationsSubtitle.textContent = "Buyer alerts for orders, payments, delivery updates and account activity.";
  sellerDashboardLink?.classList.add("hidden-nav-link");
  superAdminLink?.classList.add("hidden-nav-link");
}

function notificationIcon(type) {
  const normalizedType = String(type || "").toUpperCase();

  if (normalizedType.includes("PAYMENT")) return "₵";
  if (normalizedType.includes("ORDER")) return "#";
  if (normalizedType.includes("PAYOUT")) return "%";
  if (normalizedType.includes("DELIVERY")) return "→";
  if (normalizedType.includes("SENSITIVE")) return "!";
  return "•";
}

function formatNotificationDate(value) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderNotifications(notifications = []) {
  loadedNotifications = notifications;
  const unreadCount = notifications.filter(notification => !notification.readAt).length;

  notificationCountTitle.textContent = `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`;
  notificationCountText.textContent = unreadCount
    ? `${unreadCount} unread notice${unreadCount === 1 ? "" : "s"} need your attention.`
    : "You are up to date.";

  if (!notifications.length) {
    notificationsList.innerHTML = `
      <div class="notification-empty card">
        <div class="card-content">
          <h3>No notifications yet</h3>
          <p>When an order is placed, payment is confirmed, or important account activity happens, it will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  notificationsList.innerHTML = notifications.map(notification => {
    const isUnread = !notification.readAt;

    return `
      <article class="notification-card ${isUnread ? "unread" : ""}" data-notification-id="${notification.id}">
        <div class="notification-icon">${notificationIcon(notification.type)}</div>
        <div class="notification-body">
          <div class="notification-card-head">
            <h3>${notification.title || "Notification"}</h3>
            <span>${formatNotificationDate(notification.createdAt)}</span>
          </div>
          <p>${notification.message || ""}</p>
          <div class="notification-meta">
            <span>${notification.type || "GENERAL"}</span>
            ${isUnread ? `<button type="button" class="mark-read-btn" data-read-id="${notification.id}">Mark read</button>` : `<span>Read</span>`}
          </div>
        </div>
      </article>
    `;
  }).join("");

  notificationsList.querySelectorAll("[data-read-id]").forEach(button => {
    button.addEventListener("click", () => markNotificationRead(button.dataset.readId));
  });
}

async function loadNotifications() {
  if (!requireLogin()) return;

  clearFeedback();
  notificationCountTitle.textContent = "Loading notifications...";
  notificationCountText.textContent = "Checking latest account activity.";

  try {
    const response = await fetch(`${API_BASE}/api/notifications/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not load notifications");
    }

    renderNotifications(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("[Yenkasa Store] Could not load notifications", error);
    showFeedback(error.message, "error");
    renderNotifications([]);
  }
}

async function markNotificationRead(notificationId) {
  if (!notificationId || !authToken) return;

  try {
    const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not mark notification as read");
    }

    loadedNotifications = loadedNotifications.map(notification => (
      String(notification.id) === String(notificationId) ? data : notification
    ));
    renderNotifications(loadedNotifications);
  } catch (error) {
    console.error("[Yenkasa Store] Could not mark notification read", error);
    showFeedback(error.message, "error");
  }
}

async function markAllRead() {
  const unreadNotifications = loadedNotifications.filter(notification => !notification.readAt);

  for (const notification of unreadNotifications) {
    await markNotificationRead(notification.id);
  }
}

refreshNotificationsBtn?.addEventListener("click", loadNotifications);
markAllReadBtn?.addEventListener("click", markAllRead);

applyRoleUi();
loadNotifications();
