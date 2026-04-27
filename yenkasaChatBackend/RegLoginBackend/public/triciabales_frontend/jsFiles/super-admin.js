const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const menuToggle = document.getElementById("menuToggle");
const dashboardMenu = document.getElementById("dashboardMenu");
const dashboardMenuCloseBtn = document.getElementById("dashboardMenuCloseBtn");
const menuButtons = document.querySelectorAll(".dashboard-menu .tab-btn");
const panels = document.querySelectorAll(".super-admin-panel");
const pendingPayoutsList = document.getElementById("pendingPayoutsList");
const pendingPayoutsSectionList = document.getElementById("pendingPayoutsSectionList");
const allOrdersList = document.getElementById("allOrdersList");
const refundRequestsList = document.getElementById("refundRequestsList");
const releasedPayoutsList = document.getElementById("releasedPayoutsList");
const sellersList = document.getElementById("sellersList");
const sellerProductsList = document.getElementById("sellerProductsList");
const usersList = document.getElementById("usersList");
const superAdminNotificationCountText = document.getElementById("superAdminNotificationCountText");
const superAdminNotificationsFeedback = document.getElementById("superAdminNotificationsFeedback");
const superAdminNotificationsList = document.getElementById("superAdminNotificationsList");
const refreshSuperAdminNotificationsBtn = document.getElementById("refreshSuperAdminNotificationsBtn");
const markAllSuperAdminNotificationsReadBtn = document.getElementById("markAllSuperAdminNotificationsReadBtn");
const superAdminNotificationFilterBar = document.getElementById("superAdminNotificationFilterBar");
const storeProfileForm = document.getElementById("storeProfileForm");
const storeProfileFeedback = document.getElementById("storeProfileFeedback");
const storeProfileSaveBtn = document.getElementById("storeProfileSaveBtn");
const storeProfileRefreshBtn = document.getElementById("storeProfileRefreshBtn");
const storeLogoInput = document.getElementById("storeLogo");
const storeLogoPreview = document.getElementById("storeLogoPreview");
const API_BASE = "/triciabales-api";
let loadedSuperAdminNotifications = [];
let activeSuperAdminNotificationFilter = "all";
const hiddenSuperAdminNotificationIds = new Set(
  JSON.parse(localStorage.getItem("hiddenSuperAdminNotificationIds") || "[]").map(String)
);

if (!currentUser || currentUser.role !== "SUPER_ADMIN" || !authToken) {
  window.location.href = "/store/buyer-login";
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${authToken}`
  };
}

function getJsonAuthHeaders() {
  return {
    ...getAuthHeaders(),
    "Content-Type": "application/json"
  };
}

function isAuthFailure(status) {
  return status === 401 || status === 403;
}

function handleUnauthorized(responseData) {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("authToken");
  alert(responseData?.message || responseData?.error || "Your session has expired. Please log in again.");
  window.location.href = "/store/admin-login";
}

async function readResponseData(response) {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return {
      rawText
    };
  }
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function notificationIcon(type) {
  const normalizedType = String(type || "").toUpperCase();

  if (normalizedType.includes("PAYMENT")) return "₵";
  if (normalizedType.includes("ORDER")) return "#";
  if (normalizedType.includes("PAYOUT")) return "%";
  if (normalizedType.includes("DELIVERY")) return "→";
  if (normalizedType.includes("SENSITIVE")) return "!";
  return "•";
}

function saveHiddenSuperAdminNotifications() {
  localStorage.setItem("hiddenSuperAdminNotificationIds", JSON.stringify([...hiddenSuperAdminNotificationIds]));
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

function visibleSuperAdminNotifications() {
  return loadedSuperAdminNotifications.filter(notification => {
    if (hiddenSuperAdminNotificationIds.has(String(notification.id))) {
      return false;
    }

    if (activeSuperAdminNotificationFilter === "all") {
      return true;
    }

    return notificationDayGroup(notification.createdAt) === activeSuperAdminNotificationFilter;
  });
}

function isPayoutReleaseEligible(order) {
  return order.confirmedByBuyer === true
    || String(order.deliveryStatus || "").toLowerCase() === "delivered";
}

function isPendingPayoutOrder(order) {
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  if (!isPayoutReleaseEligible(order) || order.payoutReleased === true) {
    return false;
  }

  return paymentStatus === "paid"
    || paymentStatus === "ready_for_payout"
    || paymentStatus === "payout_on_hold";
}

function closeMenu() {
  dashboardMenu.classList.remove("open");
}

function showPanel(panelName) {
  menuButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.panel === panelName);
  });

  panels.forEach(panel => {
    panel.classList.toggle("active", panel.id === `panel-${panelName}`);
  });

  closeMenu();

  if (panelName === "notifications") {
    loadSuperAdminNotifications();
  }

  if (panelName === "store-profile") {
    loadStoreProfile();
  }

  if (panelName === "refunds") {
    loadRefundRequests();
  }
}

function renderEmpty(target, message) {
  target.innerHTML = `<p>${message}</p>`;
}

function showSuperAdminNotificationFeedback(message, type = "info") {
  if (!superAdminNotificationsFeedback) return;

  superAdminNotificationsFeedback.textContent = message;
  superAdminNotificationsFeedback.className = `orders-feedback ${type}`;
  superAdminNotificationsFeedback.classList.remove("hidden");
}

function clearSuperAdminNotificationFeedback() {
  superAdminNotificationsFeedback?.classList.add("hidden");
}

function showStoreProfileFeedback(message, type = "info") {
  if (!storeProfileFeedback) return;

  storeProfileFeedback.textContent = message;
  storeProfileFeedback.className = `orders-feedback ${type}`;
  storeProfileFeedback.classList.remove("hidden");
}

function clearStoreProfileFeedback() {
  storeProfileFeedback?.classList.add("hidden");
}

function renderStoreProfile(profile = {}) {
  const storeName = document.getElementById("storeName");
  const announcementTitle = document.getElementById("announcementTitle");
  const announcementText = document.getElementById("announcementText");
  const announcementEnabled = document.getElementById("announcementEnabled");

  if (storeName) storeName.value = profile.storeName || "Yenkasa Store";
  if (announcementTitle) announcementTitle.value = profile.announcementTitle || "";
  if (announcementText) announcementText.value = profile.announcementText || "";
  if (announcementEnabled) announcementEnabled.value = String(Boolean(profile.announcementEnabled));
  if (storeLogoPreview) {
    storeLogoPreview.src = profile.logoUrl || "/store/assets/images/YenkasaStoreLogo.png";
  }
}

async function loadStoreProfile() {
  if (!storeProfileForm) {
    return;
  }

  clearStoreProfileFeedback();

  try {
    const response = await fetch(`${API_BASE}/api/store-profile`);
    const data = await readResponseData(response);

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Could not load store profile");
    }

    renderStoreProfile(data || {});
  } catch (error) {
    console.error("[Yenkasa Store] Could not load store profile", error);
    showStoreProfileFeedback(error.message, "error");
  }
}

async function saveStoreProfile(event) {
  event.preventDefault();

  if (!storeProfileForm) {
    return;
  }

  const originalText = storeProfileSaveBtn?.textContent || "Save Store Profile";
  const formData = new FormData(storeProfileForm);

  try {
    clearStoreProfileFeedback();
    if (storeProfileSaveBtn) {
      storeProfileSaveBtn.disabled = true;
      storeProfileSaveBtn.textContent = "Saving...";
    }

    const response = await fetch(`${API_BASE}/api/store-profile`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: formData
    });
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Could not save store profile");
    }

    renderStoreProfile(data.profile || {});
    showStoreProfileFeedback(data.message || "Store profile saved.", "success");
  } catch (error) {
    console.error("[Yenkasa Store] Could not save store profile", error);
    showStoreProfileFeedback(error.message, "error");
  } finally {
    if (storeProfileSaveBtn) {
      storeProfileSaveBtn.disabled = false;
      storeProfileSaveBtn.textContent = originalText;
    }
  }
}

function renderSuperAdminNotifications(notifications = []) {
  loadedSuperAdminNotifications = notifications;

  if (!superAdminNotificationsList || !superAdminNotificationCountText) {
    return;
  }

  const filteredNotifications = visibleSuperAdminNotifications();
  const unreadCount = notifications.filter(notification => (
    !notification.readAt && !hiddenSuperAdminNotificationIds.has(String(notification.id))
  )).length;
  superAdminNotificationCountText.textContent = notifications.length
    ? `${notifications.length} notification${notifications.length === 1 ? "" : "s"} loaded. ${unreadCount} unread.`
    : "No notifications yet.";

  if (!filteredNotifications.length) {
    superAdminNotificationsList.innerHTML = `
      <div class="notification-empty card">
        <div class="card-content">
          <h3>No ${activeSuperAdminNotificationFilter === "all" ? "" : activeSuperAdminNotificationFilter} notifications</h3>
          <p>Order, payment, delivery, payout and sensitive admin activity will appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  const groups = ["today", "yesterday", "older"];

  superAdminNotificationsList.innerHTML = groups.map(group => {
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

async function loadSuperAdminNotifications() {
  if (!superAdminNotificationsList) {
    return;
  }

  clearSuperAdminNotificationFeedback();
  superAdminNotificationCountText.textContent = "Loading notifications...";

  try {
    const response = await fetch(`${API_BASE}/api/notifications/me`, {
      headers: getAuthHeaders()
    });
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Could not load notifications");
    }

    renderSuperAdminNotifications(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("[Yenkasa Store] Could not load super admin notifications", error);
    showSuperAdminNotificationFeedback(error.message, "error");
    renderSuperAdminNotifications([]);
  }
}

async function markSuperAdminNotificationRead(notificationId) {
  if (!notificationId) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: getAuthHeaders()
    });
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Could not mark notification as read");
    }

    loadedSuperAdminNotifications = loadedSuperAdminNotifications.map(notification => (
      String(notification.id) === String(notificationId) ? data : notification
    ));
    renderSuperAdminNotifications(loadedSuperAdminNotifications);
  } catch (error) {
    console.error("[Yenkasa Store] Could not mark notification read", error);
    showSuperAdminNotificationFeedback(error.message, "error");
  }
}

async function markAllSuperAdminNotificationsRead() {
  const unreadNotifications = visibleSuperAdminNotifications().filter(notification => !notification.readAt);

  for (const notification of unreadNotifications) {
    await markSuperAdminNotificationRead(notification.id);
  }
}

function hideSuperAdminNotification(notificationId) {
  if (!notificationId) {
    return;
  }

  hiddenSuperAdminNotificationIds.add(String(notificationId));
  saveHiddenSuperAdminNotifications();
  renderSuperAdminNotifications(loadedSuperAdminNotifications);
}

async function deleteSuperAdminNotification(notificationId) {
  if (!notificationId) {
    return;
  }

  const confirmed = confirm("Delete this notification permanently?");
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Could not delete notification");
    }

    loadedSuperAdminNotifications = loadedSuperAdminNotifications.filter(notification => (
      String(notification.id) !== String(notificationId)
    ));
    hiddenSuperAdminNotificationIds.delete(String(notificationId));
    saveHiddenSuperAdminNotifications();
    renderSuperAdminNotifications(loadedSuperAdminNotifications);
  } catch (error) {
    console.error("[Yenkasa Store] Could not delete super admin notification", error);
    showSuperAdminNotificationFeedback(error.message, "error");
  }
}

function renderPendingPayoutItems(target, orders) {
  if (!orders.length) {
    renderEmpty(target, "No pending seller payouts right now.");
    return;
  }

  target.innerHTML = orders.map(order => {
    const total = Number(order.total || 0);
    const commission = order.commissionAmount != null
      ? Number(order.commissionAmount)
      : total * 0.10;
    const sellerReceives = order.sellerPayoutAmount != null
      ? Number(order.sellerPayoutAmount)
      : total - commission;
    const isOnHold = order.paymentStatus === "payout_on_hold";
    const payoutStatusLabel = order.paymentStatus === "paid"
      ? "Paid - Ready For Payout"
      : formatStatus(order.paymentStatus);
    const primaryAction = isOnHold
      ? `<button class="manage-btn status payout-action-btn" data-id="${order.id}" data-action="resume">
          Mark Ready
        </button>`
      : `<button class="manage-btn status payout-action-btn" data-id="${order.id}" data-action="release">
          Release Payment
        </button>`;
    const secondaryAction = isOnHold
      ? ""
      : `<button class="manage-btn hold payout-action-btn" data-id="${order.id}" data-action="hold">
          Hold Payout
        </button>`;

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${order.sellerName || "Seller"}</strong>
            <p>Order #${order.id}</p>
          </div>
          <strong>GH₵${total.toFixed(2)}</strong>
        </div>
        <p><strong>Seller Name:</strong> ${order.sellerName || "Seller"}</p>
        <p><strong>Order #:</strong> ${order.id}</p>
        <p><strong>Buyer:</strong> ${order.customerName || "-"}</p>
        <p><strong>Delivery:</strong> ${formatStatus(order.deliveryStatus)}</p>
        <p><strong>Payout Trigger:</strong> ${order.confirmedByBuyer ? "Buyer confirmed" : "Seller marked delivered"}</p>
        <p><strong>Total:</strong> GH₵${total.toFixed(2)}</p>
        <p><strong>Commission:</strong> GH₵${commission.toFixed(2)}</p>
        <p><strong>Seller Receives:</strong> GH₵${sellerReceives.toFixed(2)}</p>
        <p><strong>Payout Status:</strong> ${payoutStatusLabel}</p>
        ${order.payoutHeldAt ? `<p><strong>Held At:</strong> ${formatDateTime(order.payoutHeldAt)}</p>` : ""}
        ${order.payoutHoldReason ? `<p><strong>Hold Reason:</strong> ${order.payoutHoldReason}</p>` : ""}
        <div class="super-admin-actions">
          ${primaryAction}
          ${secondaryAction}
        </div>
      </div>
    `;
  }).join("");
}

function renderAllOrders(orders) {
  if (!orders.length) {
    renderEmpty(allOrdersList, "No orders found.");
    return;
  }

  allOrdersList.innerHTML = orders.map(order => {
    const total = Number(order.total || 0);
    const paymentStatus = String(order.paymentStatus || "").toLowerCase();
    const canRequestRefund = total > 0 && paymentStatus !== "payment_failed" && paymentStatus !== "cancelled";

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>Order #${order.id}</strong>
            <p>${order.sellerName || "Seller"} • ${order.buyerName || order.customerName || "Customer"}</p>
          </div>
          <strong>GH₵${total.toFixed(2)}</strong>
        </div>
        <p><strong>Seller ID:</strong> ${order.sellerId || "-"}</p>
        <p><strong>Buyer ID:</strong> ${order.buyerId || "-"}</p>
        <p><strong>Buyer:</strong> ${order.buyerName || order.customerName || "-"}</p>
        <p><strong>Buyer Email:</strong> ${order.buyerEmail || "-"}</p>
        <p><strong>Payment:</strong> ${formatStatus(order.paymentStatus)}</p>
        <p><strong>Delivery:</strong> ${formatStatus(order.deliveryStatus)}</p>
        <p><strong>Buyer Confirmed:</strong> ${order.confirmedByBuyer ? "Yes" : "No"}</p>
        <div class="super-admin-actions">
          <button
            type="button"
            class="manage-btn refund refund-request-btn"
            data-id="${order.id}"
            data-total="${total.toFixed(2)}"
            ${canRequestRefund ? "" : "disabled"}
          >
            Request Refund
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderRefundRequests(refunds) {
  if (!refundRequestsList) return;

  if (!Array.isArray(refunds) || !refunds.length) {
    renderEmpty(refundRequestsList, "No refund requests recorded yet.");
    return;
  }

  refundRequestsList.innerHTML = refunds.map(refund => {
    const status = String(refund.status || "REQUESTED").toUpperCase();
    const canReview = status === "REQUESTED";
    const canProcess = status === "APPROVED";

    return `
      <div class="super-admin-item refund-item">
        <div class="super-admin-item-header">
          <div>
            <strong>Order #${refund.orderId}</strong>
            <p>${formatStatus(status)} • ${formatDateTime(refund.createdAt)}</p>
          </div>
          <strong>GH₵${Number(refund.amount || 0).toFixed(2)}</strong>
        </div>
        <p><strong>Reason:</strong> ${refund.reason || "-"}</p>
        <p><strong>Requested By:</strong> ${refund.requestedBy || "-"}</p>
        <p><strong>Reviewed By:</strong> ${refund.reviewedBy || "-"}</p>
        <p><strong>Reviewed At:</strong> ${formatDateTime(refund.reviewedAt)}</p>
        <p><strong>Processed At:</strong> ${formatDateTime(refund.processedAt)}</p>
        <div class="super-admin-actions">
          <button
            type="button"
            class="manage-btn status refund-status-btn"
            data-id="${refund.id}"
            data-status="APPROVED"
            ${canReview ? "" : "disabled"}
          >
            Approve
          </button>
          <button
            type="button"
            class="manage-btn delete refund-status-btn"
            data-id="${refund.id}"
            data-status="REJECTED"
            ${canReview ? "" : "disabled"}
          >
            Reject
          </button>
          <button
            type="button"
            class="manage-btn refund refund-status-btn"
            data-id="${refund.id}"
            data-status="PROCESSED"
            ${canProcess ? "" : "disabled"}
          >
            Mark Processed
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderReleasedPayouts(orders) {
  if (!orders.length) {
    renderEmpty(releasedPayoutsList, "No payouts have been released yet.");
    return;
  }

  releasedPayoutsList.innerHTML = orders.map(order => `
    <div class="super-admin-item">
      <div class="super-admin-item-header">
        <div>
          <strong>${order.sellerName || "Seller"}</strong>
          <p>Order #${order.id}</p>
        </div>
        <strong>GH₵${Number(order.sellerPayoutAmount || 0).toFixed(2)}</strong>
      </div>
      <p><strong>Commission:</strong> GH₵${Number(order.commissionAmount || 0).toFixed(2)}</p>
      <p><strong>Released At:</strong> ${order.payoutReleasedAt || "-"}</p>
    </div>
  `).join("");
}

function renderSellers(sellers, orders) {
  const sellerMap = new Map();

  orders.forEach(order => {
    if (!order.sellerId) return;

    const sellerKey = Number(order.sellerId);
    const existing = sellerMap.get(sellerKey) || {
      sellerId: sellerKey,
      sellerName: order.sellerName || "Seller",
      email: "-",
      phone: "-",
      verified: false,
      accountStatus: "ACTIVE",
      totalOrders: 0,
      totalSales: 0,
      pendingPayouts: 0
    };

    existing.totalOrders += 1;
    existing.totalSales += Number(order.total || 0);

    if (order.paymentStatus !== "payout_released") {
      existing.pendingPayouts += 1;
    }

    sellerMap.set(sellerKey, existing);
  });

  (Array.isArray(sellers) ? sellers : []).forEach(user => {
    const sellerKey = Number(user.id);
    const existing = sellerMap.get(sellerKey) || {
      sellerId: sellerKey,
      sellerName: user.name || "Seller",
      email: "-",
      phone: "-",
      verified: false,
      accountStatus: "ACTIVE",
      totalOrders: 0,
      totalSales: 0,
      pendingPayouts: 0
    };

    existing.sellerName = user.name || existing.sellerName;
    existing.email = user.email || existing.email;
    existing.phone = user.phone || existing.phone;
    existing.verified = Boolean(user.emailVerified);
    existing.accountStatus = user.accountStatus || existing.accountStatus;

    sellerMap.set(sellerKey, existing);
  });

  const sellerAccounts = Array.from(sellerMap.values()).sort((a, b) => {
    if (b.totalOrders !== a.totalOrders) {
      return b.totalOrders - a.totalOrders;
    }

    return b.sellerId - a.sellerId;
  });

  if (!sellerAccounts.length) {
    renderEmpty(sellersList, "No registered sellers found.");
    return;
  }

  sellersList.innerHTML = sellerAccounts.map(seller => `
    <div class="super-admin-item">
      <div class="super-admin-item-header">
        <div>
          <strong>${seller.sellerName}</strong>
          <p>Seller ID: ${seller.sellerId}</p>
        </div>
        <strong>GH₵${seller.totalSales.toFixed(2)}</strong>
      </div>
      <p><strong>Email:</strong> ${seller.email || "-"}</p>
      <p><strong>Phone:</strong> ${seller.phone || "-"}</p>
      <p><strong>Status:</strong> ${formatStatus(seller.accountStatus || "ACTIVE")}</p>
      <p><strong>Verified:</strong> ${seller.verified ? "Yes" : "No"}</p>
      <p><strong>Total Orders:</strong> ${seller.totalOrders}</p>
      <p><strong>Pending Payouts:</strong> ${seller.pendingPayouts}</p>
    </div>
  `).join("");
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderUsers(users) {
  if (!Array.isArray(users) || !users.length) {
    renderEmpty(usersList, "No registered users found.");
    return;
  }

  usersList.innerHTML = users.map(user => {
    const status = (user.accountStatus || "ACTIVE").toUpperCase();
    const isSelf = Number(user.id) === Number(currentUser.id);

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${user.name || "User"}</strong>
            <p>${user.email || "-"}</p>
          </div>
          <strong>${user.role || "-"}</strong>
        </div>
        <p><strong>User ID:</strong> ${user.id || "-"}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Verified:</strong> ${user.emailVerified ? "Yes" : "No"}</p>
        <p><strong>Phone:</strong> ${user.phone || "-"}</p>
        <p><strong>Suspended At:</strong> ${formatDateTime(user.suspendedAt)}</p>
        <p><strong>Blocked At:</strong> ${formatDateTime(user.blockedAt)}</p>
        <p><strong>Deleted At:</strong> ${formatDateTime(user.deletedAt)}</p>
        <div class="super-admin-actions">
          ${user.emailVerified ? "" : `
            <button class="manage-btn hold resend-verification-btn" data-email="${user.email || ""}">
              Resend Verification
            </button>
          `}
          <button class="manage-btn status user-status-btn" data-id="${user.id}" data-status="ACTIVE">
            Reactivate
          </button>
          <button class="manage-btn status user-status-btn" data-id="${user.id}" data-status="SUSPENDED" ${isSelf ? "disabled" : ""}>
            Suspend
          </button>
          <button class="manage-btn delete user-status-btn" data-id="${user.id}" data-status="BLOCKED" ${isSelf ? "disabled" : ""}>
            Block
          </button>
          <button class="manage-btn delete user-delete-btn" data-id="${user.id}" ${isSelf ? "disabled" : ""}>
            Delete
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function getProductPrimaryImage(product) {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length) {
    return product.imageUrls[0];
  }

  return product.imageUrl || "";
}

function renderSellerProducts(sellers, products) {
  if (!sellerProductsList) {
    return;
  }

  const sellerMap = new Map();

  (Array.isArray(sellers) ? sellers : []).forEach(seller => {
    sellerMap.set(Number(seller.id), {
      sellerId: Number(seller.id),
      sellerName: seller.name || "Seller",
      email: seller.email || "-",
      phone: seller.phone || "-",
      accountStatus: seller.accountStatus || "ACTIVE",
      products: []
    });
  });

  (Array.isArray(products) ? products : []).forEach(product => {
    const sellerId = Number(product.sellerId || 0);
    if (!sellerId) {
      return;
    }

    const existing = sellerMap.get(sellerId) || {
      sellerId,
      sellerName: product.sellerName || "Seller",
      email: "-",
      phone: "-",
      accountStatus: "ACTIVE",
      products: []
    };

    existing.sellerName = product.sellerName || existing.sellerName;
    existing.products.push(product);
    sellerMap.set(sellerId, existing);
  });

  const sellerEntries = Array.from(sellerMap.values()).sort((a, b) => {
    if (b.products.length !== a.products.length) {
      return b.products.length - a.products.length;
    }

    return String(a.sellerName).localeCompare(String(b.sellerName));
  });

  if (!sellerEntries.length) {
    renderEmpty(sellerProductsList, "No sellers or listed products found.");
    return;
  }

  sellerProductsList.innerHTML = sellerEntries.map(seller => {
    const sortedProducts = seller.products.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const productMarkup = sortedProducts.length
      ? sortedProducts.map(product => {
          const imageUrl = getProductPrimaryImage(product);
          const status = formatStatus(String(product.status || "available").toUpperCase());
          return `
            <div class="super-admin-item" style="margin-top:14px;">
              <div class="super-admin-item-header">
                <div>
                  <strong>${product.name || "Untitled Product"}</strong>
                  <p>${product.categoryType || product.category || "General"} • ${status}</p>
                </div>
                <strong>GH₵${Number(product.price || 0).toFixed(2)}</strong>
              </div>
              ${imageUrl ? `<p><img src="${imageUrl}" alt="${product.name || "Product"}" style="width:88px;height:88px;object-fit:cover;border-radius:14px;border:1px solid rgba(15,23,42,0.08);"></p>` : ""}
              <p><strong>Product ID:</strong> ${product.id || "-"}</p>
              <p><strong>Description:</strong> ${product.description || "No description available."}</p>
              <p><strong>Category:</strong> ${product.category || "-"}</p>
              <p><strong>Status:</strong> ${status}</p>
            </div>
          `;
        }).join("")
      : `<p>No products listed yet.</p>`;

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${seller.sellerName}</strong>
            <p>Seller ID: ${seller.sellerId}</p>
          </div>
          <strong>${seller.products.length} product${seller.products.length === 1 ? "" : "s"}</strong>
        </div>
        <p><strong>Email:</strong> ${seller.email}</p>
        <p><strong>Phone:</strong> ${seller.phone}</p>
        <p><strong>Status:</strong> ${formatStatus(String(seller.accountStatus || "ACTIVE").toUpperCase())}</p>
        ${productMarkup}
      </div>
    `;
  }).join("");
}

async function loadDashboard() {
  try {
    const [ordersResponse, usersResponse, productsResponse] = await Promise.all([
      fetch(
        `${API_BASE}/api/orders`,
        {
          headers: getAuthHeaders()
        }
      ),
      fetch(
        `${API_BASE}/api/users`,
        {
          headers: getAuthHeaders()
        }
      ),
      fetch(`${API_BASE}/api/triciabales`)
    ]);
    const orders = await readResponseData(ordersResponse);

    if (isAuthFailure(ordersResponse.status)) {
      handleUnauthorized(orders);
      return;
    }

    if (!ordersResponse.ok) {
      throw new Error("Could not load platform orders");
    }

    const usersPayload = await readResponseData(usersResponse);

    if (isAuthFailure(usersResponse.status)) {
      handleUnauthorized(usersPayload);
      return;
    }

    if (!usersResponse.ok || !Array.isArray(usersPayload)) {
      throw new Error("Could not load seller accounts");
    }

    const productsPayload = await readResponseData(productsResponse);

    if (!productsResponse.ok || !Array.isArray(productsPayload)) {
      throw new Error("Could not load seller products");
    }

    const sellers = usersPayload.filter(user => (user.role || "").toUpperCase() === "SELLER");

    const readyPayouts = orders.filter(order =>
      isPendingPayoutOrder(order) && order.paymentStatus !== "payout_on_hold"
    );
    const pendingPayouts = orders.filter(isPendingPayoutOrder);
    const releasedPayouts = orders.filter(order => order.paymentStatus === "payout_released");
    const totalCommission = releasedPayouts.reduce(
      (sum, order) => sum + Number(order.commissionAmount || 0),
      0
    );

    document.getElementById("total-orders").textContent = orders.length;
    document.getElementById("ready-payouts").textContent = readyPayouts.length;
    document.getElementById("commission-total").textContent = `GH₵${totalCommission.toFixed(2)}`;

    renderPendingPayoutItems(pendingPayoutsList, pendingPayouts);
    renderPendingPayoutItems(pendingPayoutsSectionList, pendingPayouts);
    renderAllOrders(orders);
    renderReleasedPayouts(releasedPayouts);
    renderSellers(sellers, orders);
    renderSellerProducts(sellers, productsPayload);
    loadRefundRequests();
  } catch (err) {
    console.error(err);
    renderEmpty(pendingPayoutsList, "Unable to load dashboard.");
    renderEmpty(pendingPayoutsSectionList, "Unable to load pending payouts.");
    renderEmpty(allOrdersList, "Unable to load orders.");
    renderEmpty(releasedPayoutsList, "Unable to load released payouts.");
    renderEmpty(sellersList, "Unable to load sellers.");
    renderEmpty(sellerProductsList, "Unable to load seller products.");
    renderEmpty(refundRequestsList, "Unable to load refunds.");
  }
}

async function loadRefundRequests() {
  if (!refundRequestsList) return;

  try {
    refundRequestsList.innerHTML = "<p>Loading refund requests...</p>";

    const response = await fetch(`${API_BASE}/api/refunds`, {
      headers: getAuthHeaders()
    });
    const refunds = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(refunds);
      return;
    }

    if (!response.ok) {
      throw new Error(refunds?.error || "Could not load refunds");
    }

    renderRefundRequests(refunds);
  } catch (err) {
    console.error(err);
    renderEmpty(refundRequestsList, "Unable to load refund requests.");
  }
}

async function loadUsers() {
  try {
    const response = await fetch(
      `${API_BASE}/api/users?includeDeleted=true`,
      {
        headers: getAuthHeaders()
      }
    );
    const users = await response.json();

    if (isAuthFailure(response.status)) {
      handleUnauthorized(users);
      return;
    }

    if (!response.ok) {
      throw new Error(users.message || users.error || "Could not load users");
    }

    renderUsers(users);
  } catch (err) {
    console.error(err);
    renderEmpty(usersList, "Unable to load registered users.");
  }
}

menuToggle.addEventListener("click", () => {
  dashboardMenu.classList.toggle("open");
});

dashboardMenuCloseBtn?.addEventListener("click", closeMenu);

menuButtons.forEach(button => {
  button.addEventListener("click", () => {
    showPanel(button.dataset.panel);
  });
});

refreshSuperAdminNotificationsBtn?.addEventListener("click", loadSuperAdminNotifications);
markAllSuperAdminNotificationsReadBtn?.addEventListener("click", markAllSuperAdminNotificationsRead);
storeProfileForm?.addEventListener("submit", saveStoreProfile);
storeProfileRefreshBtn?.addEventListener("click", loadStoreProfile);
storeLogoInput?.addEventListener("change", () => {
  const file = storeLogoInput.files?.[0];
  if (!file || !storeLogoPreview) return;

  storeLogoPreview.src = URL.createObjectURL(file);
});
allOrdersList?.addEventListener("click", async event => {
  const button = event.target.closest(".refund-request-btn");
  if (!button || button.disabled) return;

  const orderId = button.dataset.id;
  const defaultAmount = Number(button.dataset.total || 0).toFixed(2);
  const amountInput = prompt("Refund amount in GH₵", defaultAmount);
  if (amountInput === null) return;

  const amount = Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid refund amount.");
    return;
  }

  const reason = prompt("Reason for this refund");
  if (reason === null) return;

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    alert("Refund reason is required.");
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "Saving...";

    const response = await fetch(
      `${API_BASE}/api/orders/${encodeURIComponent(orderId)}/refund`,
      {
        method: "POST",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          amount,
          reason: trimmedReason
        })
      }
    );
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.error || "Could not record refund request");
    }

    alert("Refund request recorded. Review it from the Refunds tab.");
    loadDashboard();
    showPanel("refunds");
  } catch (err) {
    console.error(err);
    alert(err.message || "Unable to record refund request.");
    button.disabled = false;
    button.textContent = "Request Refund";
  }
});
refundRequestsList?.addEventListener("click", async event => {
  const button = event.target.closest(".refund-status-btn");
  if (!button || button.disabled) return;

  const refundId = button.dataset.id;
  const status = button.dataset.status;
  const confirmed = confirm(`Update this refund to ${formatStatus(status)}?`);
  if (!confirmed) return;

  try {
    button.disabled = true;
    button.textContent = "Saving...";

    const response = await fetch(
      `${API_BASE}/api/refunds/${encodeURIComponent(refundId)}/status`,
      {
        method: "PUT",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ status })
      }
    );
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.error || "Could not update refund status");
    }

    alert("Refund status updated.");
    loadRefundRequests();
  } catch (err) {
    console.error(err);
    alert(err.message || "Unable to update refund status.");
    loadRefundRequests();
  }
});
superAdminNotificationFilterBar?.addEventListener("click", event => {
  const button = event.target.closest("[data-notification-filter]");
  if (!button) return;

  activeSuperAdminNotificationFilter = button.dataset.notificationFilter || "all";
  superAdminNotificationFilterBar.querySelectorAll("[data-notification-filter]").forEach(filterButton => {
    filterButton.classList.toggle("active", filterButton === button);
  });
  renderSuperAdminNotifications(loadedSuperAdminNotifications);
});
superAdminNotificationsList?.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const notificationId = button.dataset.notificationId;
  const action = button.dataset.action;

  if (action === "read") {
    markSuperAdminNotificationRead(notificationId);
  }

  if (action === "hide") {
    hideSuperAdminNotification(notificationId);
  }

  if (action === "delete") {
    deleteSuperAdminNotification(notificationId);
  }
});

function attachReleaseHandler(target) {
  target.addEventListener("click", async event => {
    const button = event.target.closest(".payout-action-btn");
    if (!button) return;

    const orderId = button.dataset.id;
    const action = button.dataset.action;
    if (!orderId || !action) return;

    try {
      let requestBody;
      let confirmMessage;
      let successMessage;

      if (action === "hold") {
        requestBody = { holdPayout: "true" };
        confirmMessage = "Hold this seller payout for manual review?";
        successMessage = "Payout placed on hold.";
      } else if (action === "resume") {
        requestBody = { resumePayout: "true" };
        confirmMessage = "Move this payout back to ready for release?";
        successMessage = "Payout moved back to ready for release.";
      } else {
        requestBody = { releasePayout: "true" };
        confirmMessage = "Release seller payment after deducting 10% commission?";
      }

      const confirmed = confirm(confirmMessage);
      if (!confirmed) return;

      const response = await fetch(
        `${API_BASE}/api/orders/${orderId}/status`,
        {
          method: "PUT",
          headers: getJsonAuthHeaders(),
          body: JSON.stringify(requestBody)
        }
      );

      const data = await response.json();

      if (isAuthFailure(response.status)) {
        handleUnauthorized(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to release payout");
      }

      if (action === "release") {
        alert(
          `Seller payout released.\n\nCommission: GH₵${Number(data.commissionAmount || 0).toFixed(2)}\nSeller Gets: GH₵${Number(data.sellerPayoutAmount || 0).toFixed(2)}`
        );
      } else {
        alert(successMessage);
      }

      loadDashboard();
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to update payout.");
    }
  });
}

attachReleaseHandler(pendingPayoutsList);
attachReleaseHandler(pendingPayoutsSectionList);

usersList.addEventListener("click", async event => {
  const resendButton = event.target.closest(".resend-verification-btn");
  if (resendButton) {
    const email = resendButton.dataset.email;
    if (!email) return;

    try {
      const response = await fetch(
        "/triciabales-api/api/users/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not resend verification email");
      }

      const message = data.actionUrl
        ? `${data.message}\n\nFallback verification link:\n${data.actionUrl}`
        : data.message;

      alert(message);
      return;
    } catch (err) {
      console.error(err);
      alert(err.message);
      return;
    }
  }

  const deleteButton = event.target.closest(".user-delete-btn");
  if (deleteButton) {
    const userId = deleteButton.dataset.id;

    if (!userId) return;

    try {
      const confirmed = confirm("Delete this account? This will disable login and mark the account as deleted.");
      if (!confirmed) return;

      const response = await fetch(
        `${API_BASE}/api/users/${userId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders()
        }
      );

      const data = await response.json();

      if (isAuthFailure(response.status)) {
        handleUnauthorized(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not delete account");
      }

      loadUsers();
      return;
    } catch (err) {
      console.error(err);
      alert(err.message);
      return;
    }
  }

  const button = event.target.closest(".user-status-btn");
  if (!button) return;

  const userId = button.dataset.id;
  const status = button.dataset.status;
  if (!userId || !status) return;

  try {
    const response = await fetch(
      `${API_BASE}/api/users/${userId}/status`,
      {
        method: "PUT",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || "Could not update account status");
    }

    loadUsers();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

loadDashboard();
loadUsers();
loadStoreProfile();
