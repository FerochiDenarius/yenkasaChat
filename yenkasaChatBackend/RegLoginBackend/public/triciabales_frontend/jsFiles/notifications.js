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
const notificationFilterBar = document.getElementById("notificationFilterBar");
const buyerOrdersLink = document.getElementById("buyerOrdersLink");
const sellerDashboardLink = document.getElementById("sellerDashboardLink");
const superAdminLink = document.getElementById("superAdminLink");

document.querySelectorAll("[data-menu-close]").forEach(button => {
  button.addEventListener("click", () => {
    button.closest(".dashboard-menu")?.classList.add("menu-closed");
  });
});

let loadedNotifications = [];
let activeNotificationFilter = "all";
const hiddenNotificationIds = new Set(
  JSON.parse(localStorage.getItem("hiddenNotificationIds") || "[]").map(String)
);

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

function saveHiddenNotifications() {
  localStorage.setItem("hiddenNotificationIds", JSON.stringify([...hiddenNotificationIds]));
}

function notificationDayGroup(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "older";
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  if (date >= startOfToday) {
    return "today";
  }

  if (date >= startOfYesterday) {
    return "yesterday";
  }

  return "older";
}

function notificationGroupTitle(group) {
  if (group === "today") return "Today";
  if (group === "yesterday") return "Yesterday";
  return "Older";
}

function visibleNotifications() {
  return loadedNotifications.filter(notification => {
    if (hiddenNotificationIds.has(String(notification.id))) {
      return false;
    }

    if (activeNotificationFilter === "all") {
      return true;
    }

    return notificationDayGroup(notification.createdAt) === activeNotificationFilter;
  });
}

function renderNotifications(notifications = []) {
  loadedNotifications = notifications;
  const filteredNotifications = visibleNotifications();
  const unreadCount = notifications.filter(notification => (
    !notification.readAt && !hiddenNotificationIds.has(String(notification.id))
  )).length;

  notificationCountTitle.textContent = `${notifications.length} notification${notifications.length === 1 ? "" : "s"}`;
  notificationCountText.textContent = unreadCount
    ? `${unreadCount} unread notice${unreadCount === 1 ? "" : "s"} need your attention.`
    : "You are up to date.";

  if (!filteredNotifications.length) {
    notificationsList.innerHTML = `
      <div class="notification-empty card">
        <div class="card-content">
          <h3>No ${activeNotificationFilter === "all" ? "" : activeNotificationFilter} notifications</h3>
          <p>When an order is placed, payment is confirmed, or important account activity happens, it will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  const groups = ["today", "yesterday", "older"];

  notificationsList.innerHTML = groups.map(group => {
    const groupNotifications = filteredNotifications.filter(notification => (
      notificationDayGroup(notification.createdAt) === group
    ));

    if (!groupNotifications.length) {
      return "";
    }

    return `
      <section class="notification-group">
        <div class="notification-group-title">${notificationGroupTitle(group)}</div>
        ${groupNotifications.map(notification => {
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
                  ${isUnread ? `<button type="button" class="mark-read-btn" data-action="read" data-notification-id="${notification.id}">Mark read</button>` : `<span>Read</span>`}
                  <button type="button" class="mark-read-btn muted" data-action="hide" data-notification-id="${notification.id}">Hide</button>
                  <button type="button" class="mark-read-btn danger" data-action="delete" data-notification-id="${notification.id}">Delete</button>
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </section>
    `;
  }).join("");
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

function hideNotification(notificationId) {
  if (!notificationId) return;

  hiddenNotificationIds.add(String(notificationId));
  saveHiddenNotifications();
  renderNotifications(loadedNotifications);
}

async function deleteNotification(notificationId) {
  if (!notificationId || !authToken) return;

  const confirmed = confirm("Delete this notification permanently?");
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not delete notification");
    }

    loadedNotifications = loadedNotifications.filter(notification => (
      String(notification.id) !== String(notificationId)
    ));
    hiddenNotificationIds.delete(String(notificationId));
    saveHiddenNotifications();
    renderNotifications(loadedNotifications);
  } catch (error) {
    console.error("[Yenkasa Store] Could not delete notification", error);
    showFeedback(error.message, "error");
  }
}

async function markAllRead() {
  const unreadNotifications = visibleNotifications().filter(notification => !notification.readAt);

  for (const notification of unreadNotifications) {
    await markNotificationRead(notification.id);
  }
}

notificationFilterBar?.addEventListener("click", event => {
  const button = event.target.closest("[data-notification-filter]");
  if (!button) return;

  activeNotificationFilter = button.dataset.notificationFilter || "all";
  notificationFilterBar.querySelectorAll("[data-notification-filter]").forEach(filterButton => {
    filterButton.classList.toggle("active", filterButton === button);
  });
  renderNotifications(loadedNotifications);
});

notificationsList?.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const notificationId = button.dataset.notificationId;
  const action = button.dataset.action;

  if (action === "read") {
    markNotificationRead(notificationId);
  }

  if (action === "hide") {
    hideNotification(notificationId);
  }

  if (action === "delete") {
    deleteNotification(notificationId);
  }
});

refreshNotificationsBtn?.addEventListener("click", loadNotifications);
markAllReadBtn?.addEventListener("click", markAllRead);

applyRoleUi();
loadNotifications();
