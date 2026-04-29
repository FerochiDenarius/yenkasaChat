const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const menuToggle = document.getElementById("menuToggle");
const dashboardMenu = document.getElementById("dashboardMenu");
const dashboardMenuCloseBtn = document.getElementById("dashboardMenuCloseBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const menuButtons = document.querySelectorAll(".admin-sidebar-nav .tab-btn[data-panel]");
const panels = document.querySelectorAll(".super-admin-panel");
const dashboardSearchInput = document.getElementById("dashboardSearchInput");
const dashboardDateFilterBtn = document.getElementById("dashboardDateFilterBtn");
const adminNotificationsBtn = document.getElementById("adminNotificationsBtn");
const adminFullscreenBtn = document.getElementById("adminFullscreenBtn");
const adminAvatarLabel = document.getElementById("adminAvatarLabel");
const adminProfileSubtext = document.getElementById("adminProfileSubtext");
const dashboardRefreshBtn = document.getElementById("dashboardRefreshBtn");

const totalRevenueValue = document.getElementById("totalRevenueValue");
const totalRevenueGrowth = document.getElementById("totalRevenueGrowth");
const totalOrdersValue = document.getElementById("total-orders");
const totalOrdersGrowth = document.getElementById("totalOrdersGrowth");
const totalSellersValue = document.getElementById("totalSellersValue");
const totalSellersGrowth = document.getElementById("totalSellersGrowth");
const totalUsersValue = document.getElementById("totalUsersValue");
const totalUsersGrowth = document.getElementById("totalUsersGrowth");
const revenueOverviewTotal = document.getElementById("revenueOverviewTotal");
const revenueOverviewGrowth = document.getElementById("revenueOverviewGrowth");
const revenueChartSvg = document.getElementById("revenueChartSvg");
const revenueChartLabels = document.getElementById("revenueChartLabels");
const orderStatusRing = document.getElementById("orderStatusRing");
const orderStatusTotal = document.getElementById("orderStatusTotal");
const completedOrdersCount = document.getElementById("completedOrdersCount");
const pendingOrdersCount = document.getElementById("pendingOrdersCount");
const cancelledOrdersCount = document.getElementById("cancelledOrdersCount");
const pendingPayoutsMini = document.getElementById("pendingPayoutsMini");
const releasedPayoutsMini = document.getElementById("releasedPayoutsMini");
const commissionTotalValue = document.getElementById("commission-total");
const refundsMini = document.getElementById("refundsMini");
const recentOrdersTableBody = document.getElementById("recentOrdersTableBody");
const topSellersOverviewList = document.getElementById("topSellersOverviewList");
const salesBars = document.getElementById("salesBars");
const reportsOverviewCards = document.getElementById("reportsOverviewCards");

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
const dashboardState = {
  orders: [],
  users: [],
  sellers: [],
  products: [],
  refunds: [],
  paymentAudit: [],
  loadedSuperAdminNotifications: []
};
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
    return { rawText };
  }
}

function formatStatus(status) {
  if (!status) {
    return "-";
  }

  return String(status)
    .toLowerCase()
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCurrency(value) {
  return `GH₵${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatCompactCurrency(value) {
  return `GH₵${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatNotificationDate(value) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

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

function getOrderDate(order) {
  const candidates = [
    order?.createdAt,
    order?.orderedAt,
    order?.updatedAt,
    order?.date,
    order?.orderDate,
    order?.payoutReleasedAt
  ];

  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekRangeLabel() {
  const now = new Date();
  const dayIndex = now.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return `${formatter.format(monday)} - ${formatter.format(sunday)}`;
}

function percentageChange(current, previous) {
  if (!previous && !current) {
    return 0;
  }

  if (!previous) {
    return 100;
  }

  return ((current - previous) / previous) * 100;
}

function formatGrowth(current, previous) {
  const change = percentageChange(current, previous);
  const rounded = Math.abs(change).toFixed(1);
  const prefix = change >= 0 ? "+" : "-";
  return `${prefix}${rounded}% vs last week`;
}

function initialsFromName(name, fallback = "YS") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return fallback;
  }

  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function visibleSuperAdminNotifications() {
  return dashboardState.loadedSuperAdminNotifications.filter(notification => {
    if (hiddenSuperAdminNotificationIds.has(String(notification.id))) {
      return false;
    }

    if (activeSuperAdminNotificationFilter === "all") {
      return true;
    }

    return notificationDayGroup(notification.createdAt) === activeSuperAdminNotificationFilter;
  });
}

function isOrderCompleted(order) {
  const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  return order.confirmedByBuyer === true
    || deliveryStatus === "delivered"
    || paymentStatus === "paid";
}

function isOrderCancelled(order) {
  const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  return deliveryStatus === "cancelled" || paymentStatus === "cancelled" || paymentStatus === "payment_failed";
}

function isPaystackSplitOrder(order) {
  return String(order.paymentMethod || "").toLowerCase() === "paystack"
    && (
      String(order.splitMode || order.paystackSplitMode || "").toLowerCase() === "paystack_subaccount"
      || String(order.payoutStatus || "").toLowerCase() === "not_required"
      || Boolean(order.sellerSubaccountCode)
      || order.splitUsed === true
    );
}

function isLegacyPayoutOrder(order) {
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const payoutStatus = String(order.payoutStatus || "").toLowerCase();
  return paymentStatus === "ready_for_payout"
    || paymentStatus === "payout_on_hold"
    || paymentStatus === "payout_released"
    || payoutStatus === "pending"
    || payoutStatus === "released";
}

function isPendingPayoutOrder(order) {
  return isPaystackSplitOrder(order) || isLegacyPayoutOrder(order);
}

function splitSettlementDetails(order) {
  const gross = Number(order.grossAmount ?? order.total ?? 0);
  const commission = Number(order.platformCommissionAmount ?? order.platformCommission ?? order.commissionAmount ?? gross * 0.10);
  const settlement = Number(order.sellerSettlementAmount ?? order.sellerExpectedSettlement ?? order.sellerPayoutAmount ?? gross - commission);
  return { gross, commission, settlement };
}

function paymentApiErrorMessage(data, fallback) {
  return data?.message || data?.error || data?.details || fallback;
}

function canCancelOrder(order) {
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
  return paymentStatus !== "paid"
    && paymentStatus !== "refunded"
    && paymentStatus !== "partially_refunded"
    && paymentStatus !== "cancelled"
    && deliveryStatus !== "cancelled";
}

function getProductPrimaryImage(product) {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length) {
    return product.imageUrls[0];
  }

  return product.imageUrl || "";
}

function closeMenu() {
  dashboardMenu?.classList.remove("open");
}

function openMenu() {
  dashboardMenu?.classList.add("open");
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
  if (!target) {
    return;
  }

  target.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function legacyPayoutWarning() {
  return "This order was created under the old payout flow. Check Paystack Dashboard before taking action.";
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
  dashboardState.loadedSuperAdminNotifications = notifications;

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
      <div class="placeholder-message-card">
        <h3>No ${activeSuperAdminNotificationFilter === "all" ? "" : activeSuperAdminNotificationFilter} notifications</h3>
        <p>Order, payment, delivery, payout and sensitive admin activity will appear here.</p>
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
            <article class="notification-card ${isUnread ? "unread" : ""}">
              <div class="notification-icon">${escapeHtml(notificationIcon(notification.type))}</div>
              <div class="notification-body">
                <div class="notification-card-head">
                  <h3>${escapeHtml(notification.title || "Notification")}</h3>
                  <span>${escapeHtml(formatNotificationDate(notification.createdAt))}</span>
                </div>
                <p>${escapeHtml(notification.message || "")}</p>
                <div class="notification-meta">
                  <span>${escapeHtml(notification.type || "GENERAL")}</span>
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

    dashboardState.loadedSuperAdminNotifications = dashboardState.loadedSuperAdminNotifications.map(notification => (
      String(notification.id) === String(notificationId) ? data : notification
    ));
    renderSuperAdminNotifications(dashboardState.loadedSuperAdminNotifications);
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
  renderSuperAdminNotifications(dashboardState.loadedSuperAdminNotifications);
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

    dashboardState.loadedSuperAdminNotifications = dashboardState.loadedSuperAdminNotifications.filter(notification => (
      String(notification.id) !== String(notificationId)
    ));
    hiddenSuperAdminNotificationIds.delete(String(notificationId));
    saveHiddenSuperAdminNotifications();
    renderSuperAdminNotifications(dashboardState.loadedSuperAdminNotifications);
  } catch (error) {
    console.error("[Yenkasa Store] Could not delete super admin notification", error);
    showSuperAdminNotificationFeedback(error.message, "error");
  }
}

function renderPendingPayoutItems(target, orders) {
  if (!target) {
    return;
  }

  if (!orders.length) {
    renderEmpty(target, "No split-payment orders to audit right now.");
    return;
  }

  target.innerHTML = orders.map(order => {
    const { gross, commission, settlement } = splitSettlementDetails(order);
    const splitOrder = isPaystackSplitOrder(order);
    const legacyWarning = !splitOrder && isLegacyPayoutOrder(order)
      ? `<div class="orders-feedback error">${legacyPayoutWarning()}</div>`
      : "";
    const settlementMessage = splitOrder
      ? "Payment split handled by Paystack. Manual payout release is not required."
      : "Legacy payout state detected.";

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${escapeHtml(order.sellerName || "Seller")}</strong>
            <p>Order #${escapeHtml(order.id || order.orderId || "-")}</p>
          </div>
          <strong>${escapeHtml(formatCompactCurrency(gross))}</strong>
        </div>
        ${legacyWarning}
        <p><strong>Buyer:</strong> ${escapeHtml(order.customerName || order.buyerName || order.buyerEmail || "-")}</p>
        <p><strong>Payment:</strong> ${escapeHtml(formatStatus(order.paymentStatus || order.transactionStatus))}</p>
        <p><strong>Delivery:</strong> ${escapeHtml(formatStatus(order.deliveryStatus))}</p>
        <p><strong>Paystack Reference:</strong> ${escapeHtml(order.paystackReference || "-")}</p>
        <p><strong>Seller Subaccount:</strong> ${escapeHtml(order.sellerSubaccountCode || "-")}</p>
        <p><strong>Yenkasa Commission:</strong> ${escapeHtml(formatCompactCurrency(commission))} <small>(10%)</small></p>
        <p><strong>Seller Settlement:</strong> ${escapeHtml(formatCompactCurrency(settlement))} <small>(90%)</small></p>
        <p><strong>Split Mode:</strong> ${escapeHtml(order.splitMode || order.paystackSplitMode || "-")}</p>
        <p><strong>Settlement Status:</strong> ${splitOrder ? "Handled by Paystack" : escapeHtml(formatStatus(order.payoutStatus || order.paymentStatus || order.transactionStatus))}</p>
        <p>${escapeHtml(settlementMessage)}</p>
      </div>
    `;
  }).join("");
}

function renderAllOrders(orders) {
  if (!allOrdersList) {
    return;
  }

  if (!orders.length) {
    renderEmpty(allOrdersList, "No orders found.");
    return;
  }

  allOrdersList.innerHTML = orders.map(order => {
    const total = Number(order.total || 0);
    const paymentStatus = String(order.paymentStatus || "").toLowerCase();
    const canRequestRefund = total > 0 && paymentStatus !== "payment_failed" && paymentStatus !== "cancelled";
    const canCancel = canCancelOrder(order);
    const splitOrder = isPaystackSplitOrder(order);
    const legacyWarning = !splitOrder && isLegacyPayoutOrder(order)
      ? `<div class="orders-feedback error">${legacyPayoutWarning()}</div>`
      : "";
    const { commission, settlement } = splitSettlementDetails(order);

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>Order #${escapeHtml(order.id || "-")}</strong>
            <p>${escapeHtml(order.sellerName || "Seller")} • ${escapeHtml(order.buyerName || order.customerName || "Customer")}</p>
          </div>
          <strong>${escapeHtml(formatCompactCurrency(total))}</strong>
        </div>
        ${legacyWarning}
        <p><strong>Seller ID:</strong> ${escapeHtml(order.sellerId || "-")}</p>
        <p><strong>Buyer ID:</strong> ${escapeHtml(order.buyerId || "-")}</p>
        <p><strong>Buyer Email:</strong> ${escapeHtml(order.buyerEmail || "-")}</p>
        <p><strong>Payment:</strong> ${escapeHtml(formatStatus(order.paymentStatus))}</p>
        <p><strong>Delivery:</strong> ${escapeHtml(formatStatus(order.deliveryStatus))}</p>
        <p><strong>Buyer Confirmed:</strong> ${order.confirmedByBuyer ? "Yes" : "No"}</p>
        ${splitOrder ? `
          <p><strong>Settlement:</strong> Payment split handled by Paystack</p>
          <p><strong>Paystack Reference:</strong> ${escapeHtml(order.paystackReference || "-")}</p>
          <p><strong>Seller Subaccount:</strong> ${escapeHtml(order.sellerSubaccountCode || "-")}</p>
          <p><strong>Yenkasa Commission:</strong> ${escapeHtml(formatCompactCurrency(commission))}</p>
          <p><strong>Seller Settlement:</strong> ${escapeHtml(formatCompactCurrency(settlement))}</p>
        ` : ""}
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
          <button
            type="button"
            class="manage-btn delete cancel-order-btn"
            data-id="${order.id}"
            ${canCancel ? "" : "disabled"}
          >
            Cancel Order
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
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>Order #${escapeHtml(refund.orderId || "-")}</strong>
            <p>${escapeHtml(formatStatus(status))} • ${escapeHtml(formatDateTime(refund.createdAt))}</p>
          </div>
          <strong>${escapeHtml(formatCompactCurrency(refund.amount || 0))}</strong>
        </div>
        <p><strong>Reason:</strong> ${escapeHtml(refund.reason || "-")}</p>
        <p><strong>Requested By:</strong> ${escapeHtml(refund.requestedBy || "-")}</p>
        <p><strong>Reviewed By:</strong> ${escapeHtml(refund.reviewedBy || "-")}</p>
        <p><strong>Reviewed At:</strong> ${escapeHtml(formatDateTime(refund.reviewedAt))}</p>
        <p><strong>Processed At:</strong> ${escapeHtml(formatDateTime(refund.processedAt))}</p>
        <p><strong>Paystack:</strong> Refunds are processed through Paystack using the transaction reference.</p>
        <div class="super-admin-actions">
          <button type="button" class="manage-btn status refund-status-btn" data-id="${refund.id}" data-status="APPROVED" ${canReview ? "" : "disabled"}>Approve</button>
          <button type="button" class="manage-btn delete refund-status-btn" data-id="${refund.id}" data-status="REJECTED" ${canReview ? "" : "disabled"}>Reject</button>
          <button type="button" class="manage-btn refund refund-status-btn" data-id="${refund.id}" data-status="PROCESSED" ${canProcess ? "" : "disabled"}>Mark Processed</button>
        </div>
      </div>
    `;
  }).join("");
}

function buildSellerSummaries(sellers, orders) {
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

    if (!isPaystackSplitOrder(order) && isLegacyPayoutOrder(order)) {
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

  return Array.from(sellerMap.values()).sort((a, b) => {
    if (b.totalSales !== a.totalSales) {
      return b.totalSales - a.totalSales;
    }

    return b.totalOrders - a.totalOrders;
  });
}

function renderSellers(sellers, orders) {
  if (!sellersList) {
    return;
  }

  const sellerAccounts = buildSellerSummaries(sellers, orders);

  if (!sellerAccounts.length) {
    renderEmpty(sellersList, "No registered sellers found.");
    return;
  }

  sellersList.innerHTML = sellerAccounts.map(seller => `
    <div class="super-admin-item">
      <div class="super-admin-item-header">
        <div>
          <strong>${escapeHtml(seller.sellerName)}</strong>
          <p>Seller ID: ${escapeHtml(seller.sellerId)}</p>
        </div>
        <strong>${escapeHtml(formatCompactCurrency(seller.totalSales))}</strong>
      </div>
      <p><strong>Email:</strong> ${escapeHtml(seller.email || "-")}</p>
      <p><strong>Phone:</strong> ${escapeHtml(seller.phone || "-")}</p>
      <p><strong>Status:</strong> ${escapeHtml(formatStatus(seller.accountStatus || "ACTIVE"))}</p>
      <p><strong>Verified:</strong> ${seller.verified ? "Yes" : "No"}</p>
      <p><strong>Total Orders:</strong> ${escapeHtml(seller.totalOrders)}</p>
      <p><strong>Legacy Payout Risk:</strong> ${escapeHtml(seller.pendingPayouts)}</p>
    </div>
  `).join("");
}

function renderUsers(users) {
  if (!usersList) {
    return;
  }

  if (!Array.isArray(users) || !users.length) {
    renderEmpty(usersList, "No registered users found.");
    return;
  }

  usersList.innerHTML = users.map(user => {
    const status = String(user.accountStatus || "ACTIVE").toUpperCase();
    const isSelf = Number(user.id) === Number(currentUser.id);

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${escapeHtml(user.name || "User")}</strong>
            <p>${escapeHtml(user.email || "-")}</p>
          </div>
          <strong>${escapeHtml(user.role || "-")}</strong>
        </div>
        <p><strong>User ID:</strong> ${escapeHtml(user.id || "-")}</p>
        <p><strong>Status:</strong> ${escapeHtml(status)}</p>
        <p><strong>Verified:</strong> ${user.emailVerified ? "Yes" : "No"}</p>
        <p><strong>Phone:</strong> ${escapeHtml(user.phone || "-")}</p>
        <p><strong>Suspended At:</strong> ${escapeHtml(formatDateTime(user.suspendedAt))}</p>
        <p><strong>Blocked At:</strong> ${escapeHtml(formatDateTime(user.blockedAt))}</p>
        <p><strong>Deleted At:</strong> ${escapeHtml(formatDateTime(user.deletedAt))}</p>
        <div class="super-admin-actions">
          ${user.emailVerified ? "" : `<button class="manage-btn hold resend-verification-btn" data-email="${escapeHtml(user.email || "")}">Resend Verification</button>`}
          <button class="manage-btn status user-status-btn" data-id="${user.id}" data-status="ACTIVE">Reactivate</button>
          <button class="manage-btn status user-status-btn" data-id="${user.id}" data-status="SUSPENDED" ${isSelf ? "disabled" : ""}>Suspend</button>
          <button class="manage-btn delete user-status-btn" data-id="${user.id}" data-status="BLOCKED" ${isSelf ? "disabled" : ""}>Block</button>
          <button class="manage-btn delete user-delete-btn" data-id="${user.id}" ${isSelf ? "disabled" : ""}>Delete</button>
        </div>
      </div>
    `;
  }).join("");
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
    if (!sellerId) return;

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
                  <strong>${escapeHtml(product.name || "Untitled Product")}</strong>
                  <p>${escapeHtml(product.categoryType || product.category || "General")} • ${escapeHtml(status)}</p>
                </div>
                <strong>${escapeHtml(formatCompactCurrency(product.price || 0))}</strong>
              </div>
              ${imageUrl ? `<p><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Product")}" style="width:88px;height:88px;object-fit:cover;border-radius:14px;border:1px solid rgba(15,23,42,0.08);"></p>` : ""}
              <p><strong>Product ID:</strong> ${escapeHtml(product.id || "-")}</p>
              <p><strong>Description:</strong> ${escapeHtml(product.description || "No description available.")}</p>
              <p><strong>Category:</strong> ${escapeHtml(product.category || "-")}</p>
              <p><strong>Status:</strong> ${escapeHtml(status)}</p>
            </div>
          `;
        }).join("")
      : `<p>No products listed yet.</p>`;

    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${escapeHtml(seller.sellerName)}</strong>
            <p>Seller ID: ${escapeHtml(seller.sellerId)}</p>
          </div>
          <strong>${escapeHtml(seller.products.length)} product${seller.products.length === 1 ? "" : "s"}</strong>
        </div>
        <p><strong>Email:</strong> ${escapeHtml(seller.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(seller.phone)}</p>
        <p><strong>Status:</strong> ${escapeHtml(formatStatus(String(seller.accountStatus || "ACTIVE").toUpperCase()))}</p>
        ${productMarkup}
      </div>
    `;
  }).join("");
}

function renderRecentOrdersTable(orders) {
  if (!recentOrdersTableBody) {
    return;
  }

  const recentOrders = orders
    .slice()
    .sort((a, b) => {
      const dateA = getOrderDate(a)?.getTime() || 0;
      const dateB = getOrderDate(b)?.getTime() || 0;
      return dateB - dateA || Number(b.id || 0) - Number(a.id || 0);
    })
    .slice(0, 6);

  if (!recentOrders.length) {
    recentOrdersTableBody.innerHTML = `<tr><td colspan="5">No recent orders found.</td></tr>`;
    return;
  }

  recentOrdersTableBody.innerHTML = recentOrders.map(order => {
    let statusClass = "pending";
    let statusLabel = "Pending";

    if (isOrderCancelled(order)) {
      statusClass = "cancelled";
      statusLabel = "Cancelled";
    } else if (isOrderCompleted(order)) {
      statusClass = "completed";
      statusLabel = "Completed";
    }

    return `
      <tr>
        <td>ORD-${escapeHtml(order.id || "-")}</td>
        <td>${escapeHtml(order.buyerName || order.customerName || "-")}</td>
        <td>${escapeHtml(order.sellerName || "-")}</td>
        <td>${escapeHtml(formatCompactCurrency(order.total || 0))}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      </tr>
    `;
  }).join("");
}

function renderTopSellersOverview(sellers, orders) {
  if (!topSellersOverviewList) {
    return;
  }

  const summary = buildSellerSummaries(sellers, orders).slice(0, 5);

  if (!summary.length) {
    topSellersOverviewList.innerHTML = `<p>No top sellers available yet.</p>`;
    return;
  }

  topSellersOverviewList.innerHTML = summary.map((seller, index) => `
    <div class="top-seller-row">
      <span class="top-seller-rank">${index + 1}</span>
      <span class="top-seller-avatar">${escapeHtml(initialsFromName(seller.sellerName, "YS"))}</span>
      <div class="top-seller-copy">
        <strong>${escapeHtml(seller.sellerName)}</strong>
        <span>${escapeHtml(seller.totalOrders)} order${seller.totalOrders === 1 ? "" : "s"}</span>
      </div>
      <span class="top-seller-amount">${escapeHtml(formatCompactCurrency(seller.totalSales))}</span>
    </div>
  `).join("");
}

function renderReportsOverview() {
  if (!reportsOverviewCards) {
    return;
  }

  const orders = dashboardState.orders;
  const users = dashboardState.users;
  const sellers = dashboardState.sellers;
  const refunds = dashboardState.refunds;
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const cards = [
    {
      label: "Revenue Captured",
      value: formatCompactCurrency(totalRevenue),
      note: `${orders.length} orders tracked`
    },
    {
      label: "Seller Base",
      value: String(sellers.length),
      note: `${users.length} total users on platform`
    },
    {
      label: "Refund Exposure",
      value: formatCompactCurrency(refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0)),
      note: `${refunds.length} refund request${refunds.length === 1 ? "" : "s"}`
    },
    {
      label: "Live Products",
      value: String(dashboardState.products.length),
      note: "Current products visible in marketplace"
    }
  ];

  reportsOverviewCards.innerHTML = cards.map(card => `
    <article class="report-summary-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.note)}</p>
    </article>
  `).join("");
}

function buildWeeklyRevenueSeries(orders) {
  const now = new Date();
  const today = startOfDay(now);
  const series = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    series.push({
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      date,
      total: 0
    });
  }

  orders.forEach(order => {
    const orderDate = getOrderDate(order);
    if (!orderDate) {
      return;
    }

    const match = series.find(point => startOfDay(point.date).getTime() === startOfDay(orderDate).getTime());
    if (match) {
      match.total += Number(order.total || 0);
    }
  });

  return series;
}

function renderRevenueChart(series) {
  if (!revenueChartSvg || !revenueChartLabels) {
    return;
  }

  if (!series.length) {
    revenueChartSvg.innerHTML = "";
    revenueChartLabels.innerHTML = "";
    return;
  }

  const maxValue = Math.max(...series.map(point => point.total), 1);
  const width = 640;
  const height = 260;
  const paddingX = 28;
  const paddingTop = 20;
  const paddingBottom = 28;
  const innerWidth = width - (paddingX * 2);
  const innerHeight = height - paddingTop - paddingBottom;

  const points = series.map((point, index) => {
    const x = paddingX + ((innerWidth / Math.max(series.length - 1, 1)) * index);
    const y = paddingTop + (innerHeight - ((point.total / maxValue) * innerHeight));
    return { x, y, total: point.total };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  revenueChartSvg.innerHTML = `
    <defs>
      <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(214,161,38,0.42)"></stop>
        <stop offset="100%" stop-color="rgba(214,161,38,0.02)"></stop>
      </linearGradient>
    </defs>
    ${[0.25, 0.5, 0.75, 1].map(level => {
      const y = paddingTop + (innerHeight - (innerHeight * level));
      return `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="rgba(60, 42, 24, 0.08)" stroke-width="1"></line>`;
    }).join("")}
    <path d="${areaPath}" fill="url(#adminRevenueGradient)" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="#c79418" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
    ${points.map(point => `
      <circle cx="${point.x}" cy="${point.y}" r="5" fill="#ffffff" stroke="#c79418" stroke-width="3"></circle>
    `).join("")}
  `;

  revenueChartLabels.innerHTML = series.map(point => `<span>${escapeHtml(point.label)}</span>`).join("");
}

function buildOrderStatusSummary(orders) {
  let completed = 0;
  let pending = 0;
  let cancelled = 0;

  orders.forEach(order => {
    if (isOrderCancelled(order)) {
      cancelled += 1;
      return;
    }

    if (isOrderCompleted(order)) {
      completed += 1;
      return;
    }

    pending += 1;
  });

  return { completed, pending, cancelled, total: orders.length };
}

function renderOrderStatusChart(summary) {
  if (!orderStatusRing) {
    return;
  }

  const total = Math.max(summary.total, 1);
  const completedPercent = (summary.completed / total) * 360;
  const pendingPercent = (summary.pending / total) * 360;
  const cancelledPercent = (summary.cancelled / total) * 360;
  const completedEnd = completedPercent;
  const pendingEnd = completedPercent + pendingPercent;
  const cancelledEnd = completedPercent + pendingPercent + cancelledPercent;

  orderStatusRing.style.background = `conic-gradient(
    #35aa56 0deg ${completedEnd}deg,
    #f3b42e ${completedEnd}deg ${pendingEnd}deg,
    #ef5a5a ${pendingEnd}deg ${cancelledEnd}deg,
    #f0ece7 ${cancelledEnd}deg 360deg
  )`;

  orderStatusTotal.textContent = String(summary.total);
  completedOrdersCount.textContent = `${summary.completed}`;
  pendingOrdersCount.textContent = `${summary.pending}`;
  cancelledOrdersCount.textContent = `${summary.cancelled}`;
}

function buildMonthlySalesBars(orders) {
  const now = new Date();
  const buckets = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    buckets.push({
      label: bucketDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      date: startOfDay(bucketDate),
      total: 0
    });
  }

  orders.forEach(order => {
    const date = getOrderDate(order);
    if (!date) {
      return;
    }

    const bucket = buckets.find(item => item.date.getTime() === startOfDay(date).getTime());
    if (bucket) {
      bucket.total += Number(order.total || 0);
    }
  });

  return buckets;
}

function renderSalesBars(bars) {
  if (!salesBars) {
    return;
  }

  if (!bars.length) {
    salesBars.innerHTML = "";
    return;
  }

  const maxValue = Math.max(...bars.map(item => item.total), 1);
  salesBars.innerHTML = bars.map(bar => {
    const percent = Math.max(8, (bar.total / maxValue) * 100);
    return `
      <div class="sales-bar-column">
        <div class="sales-bar-track">
          <div class="sales-bar" style="--bar-height:${percent};" title="${escapeHtml(formatCompactCurrency(bar.total))}"></div>
        </div>
        <span class="sales-bar-label">${escapeHtml(bar.label.replace(/^[A-Za-z]+\s/, ""))}</span>
      </div>
    `;
  }).join("");
}

function renderDashboardSummary() {
  const orders = dashboardState.orders;
  const users = dashboardState.users;
  const sellers = dashboardState.sellers;
  const refunds = dashboardState.refunds;
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const thisWeekStart = startOfDay(new Date());
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  const previousWeekStart = new Date(thisWeekStart);
  previousWeekStart.setDate(thisWeekStart.getDate() - 7);

  const currentWeekOrders = orders.filter(order => {
    const date = getOrderDate(order);
    return date && date >= thisWeekStart;
  });
  const previousWeekOrders = orders.filter(order => {
    const date = getOrderDate(order);
    return date && date >= previousWeekStart && date < thisWeekStart;
  });
  const currentWeekRevenue = currentWeekOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const previousWeekRevenue = previousWeekOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const currentWeekUsers = users.filter(user => {
    const date = getOrderDate(user);
    return date && date >= thisWeekStart;
  }).length;
  const previousWeekUsers = users.filter(user => {
    const date = getOrderDate(user);
    return date && date >= previousWeekStart && date < thisWeekStart;
  }).length;
  const currentWeekSellers = sellers.filter(user => {
    const date = getOrderDate(user);
    return date && date >= thisWeekStart;
  }).length;
  const previousWeekSellers = sellers.filter(user => {
    const date = getOrderDate(user);
    return date && date >= previousWeekStart && date < thisWeekStart;
  }).length;

  totalRevenueValue.textContent = formatCurrency(totalRevenue);
  totalRevenueGrowth.textContent = formatGrowth(currentWeekRevenue, previousWeekRevenue);
  totalOrdersValue.textContent = String(orders.length);
  totalOrdersGrowth.textContent = formatGrowth(currentWeekOrders.length, previousWeekOrders.length);
  totalSellersValue.textContent = String(sellers.length);
  totalSellersGrowth.textContent = formatGrowth(currentWeekSellers, previousWeekSellers);
  totalUsersValue.textContent = String(users.length);
  totalUsersGrowth.textContent = formatGrowth(currentWeekUsers, previousWeekUsers);

  revenueOverviewTotal.textContent = formatCurrency(currentWeekRevenue);
  revenueOverviewGrowth.textContent = formatGrowth(currentWeekRevenue, previousWeekRevenue);
  renderRevenueChart(buildWeeklyRevenueSeries(orders));

  const orderStatus = buildOrderStatusSummary(orders);
  renderOrderStatusChart(orderStatus);

  const settlementOrders = orders.filter(isPaystackSplitOrder);
  const legacyPayoutOrders = orders.filter(order => !isPaystackSplitOrder(order) && isLegacyPayoutOrder(order));
  const totalCommission = settlementOrders.reduce((sum, order) => sum + splitSettlementDetails(order).commission, 0);
  const pendingPayoutAmount = legacyPayoutOrders.reduce((sum, order) => sum + Number(order.sellerPayoutAmount || 0), 0);
  const releasedPayoutAmount = settlementOrders.reduce((sum, order) => sum + splitSettlementDetails(order).settlement, 0);
  const refundsAmount = refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

  pendingPayoutsMini.textContent = formatCurrency(pendingPayoutAmount);
  releasedPayoutsMini.textContent = formatCurrency(releasedPayoutAmount);
  commissionTotalValue.textContent = formatCurrency(totalCommission);
  refundsMini.textContent = formatCurrency(refundsAmount);

  renderRecentOrdersTable(orders);
  renderTopSellersOverview(sellers, orders);
  renderSalesBars(buildMonthlySalesBars(orders));
  renderReportsOverview();
}

async function loadDashboard() {
  try {
    const [ordersResponse, usersResponse, productsResponse, refundsResponse, paymentAuditResponse] = await Promise.all([
      fetch(`${API_BASE}/api/orders`, { headers: getAuthHeaders() }),
      fetch(`${API_BASE}/api/users`, { headers: getAuthHeaders() }),
      fetch(`${API_BASE}/api/triciabales`),
      fetch(`${API_BASE}/api/refunds`, { headers: getAuthHeaders() }),
      fetch(`${API_BASE}/api/paystack/audit`, { headers: getAuthHeaders() })
    ]);

    const orders = await readResponseData(ordersResponse);
    const usersPayload = await readResponseData(usersResponse);
    const productsPayload = await readResponseData(productsResponse);
    const refundsPayload = await readResponseData(refundsResponse);
    const paymentAuditPayload = await readResponseData(paymentAuditResponse);

    if (isAuthFailure(ordersResponse.status)) {
      handleUnauthorized(orders);
      return;
    }

    if (isAuthFailure(usersResponse.status)) {
      handleUnauthorized(usersPayload);
      return;
    }

    if (!ordersResponse.ok) {
      throw new Error("Could not load platform orders");
    }

    if (!usersResponse.ok || !Array.isArray(usersPayload)) {
      throw new Error("Could not load seller accounts");
    }

    if (!productsResponse.ok || !Array.isArray(productsPayload)) {
      throw new Error("Could not load seller products");
    }

    if (refundsResponse.ok && Array.isArray(refundsPayload)) {
      dashboardState.refunds = refundsPayload;
      renderRefundRequests(refundsPayload);
    } else {
      dashboardState.refunds = [];
      renderEmpty(refundRequestsList, "Unable to load refund requests.");
    }

    dashboardState.orders = Array.isArray(orders) ? orders : [];
    dashboardState.users = usersPayload;
    dashboardState.sellers = usersPayload.filter(user => String(user.role || "").toUpperCase() === "SELLER");
    dashboardState.products = productsPayload;
    dashboardState.paymentAudit = paymentAuditResponse.ok && Array.isArray(paymentAuditPayload?.orders)
      ? paymentAuditPayload.orders
      : dashboardState.orders.filter(isPaystackSplitOrder);

    dashboardDateFilterBtn.textContent = getWeekRangeLabel();
    renderDashboardSummary();
    renderPendingPayoutItems(pendingPayoutsList, dashboardState.orders.filter(isPendingPayoutOrder));
    renderPendingPayoutItems(pendingPayoutsSectionList, dashboardState.orders.filter(isPendingPayoutOrder));
    renderAllOrders(dashboardState.orders);
    renderReleasedPayouts(dashboardState.paymentAudit);
    renderSellers(dashboardState.sellers, dashboardState.orders);
    renderUsers(dashboardState.users);
    renderSellerProducts(dashboardState.sellers, dashboardState.products);
  } catch (error) {
    console.error(error);
    renderEmpty(pendingPayoutsList, "Unable to load dashboard.");
    renderEmpty(pendingPayoutsSectionList, "Unable to load settlement audit.");
    renderEmpty(allOrdersList, "Unable to load orders.");
    renderEmpty(releasedPayoutsList, "Unable to load released payouts.");
    renderEmpty(sellersList, "Unable to load sellers.");
    renderEmpty(sellerProductsList, "Unable to load seller products.");
    renderEmpty(usersList, "Unable to load users.");
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

    dashboardState.refunds = Array.isArray(refunds) ? refunds : [];
    renderRefundRequests(dashboardState.refunds);
    renderDashboardSummary();
  } catch (error) {
    console.error(error);
    renderEmpty(refundRequestsList, "Unable to load refund requests.");
  }
}

async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE}/api/users?includeDeleted=true`, {
      headers: getAuthHeaders()
    });
    const users = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(users);
      return;
    }

    if (!response.ok || !Array.isArray(users)) {
      throw new Error(users?.message || users?.error || "Could not load users");
    }

    dashboardState.users = users;
    dashboardState.sellers = users.filter(user => String(user.role || "").toUpperCase() === "SELLER");
    renderUsers(users);
    renderSellers(dashboardState.sellers, dashboardState.orders);
    renderSellerProducts(dashboardState.sellers, dashboardState.products);
    renderDashboardSummary();
  } catch (error) {
    console.error(error);
    renderEmpty(usersList, "Unable to load registered users.");
  }
}

function renderReleasedPayouts(orders) {
  if (!releasedPayoutsList) {
    return;
  }

  if (!orders.length) {
    renderEmpty(releasedPayoutsList, "No Paystack split settlements recorded yet.");
    return;
  }

  releasedPayoutsList.innerHTML = orders.map(order => {
    const { gross, commission, settlement } = splitSettlementDetails(order);
    return `
      <div class="super-admin-item">
        <div class="super-admin-item-header">
          <div>
            <strong>${escapeHtml(order.sellerName || "Seller")}</strong>
            <p>Order #${escapeHtml(order.id || "-")}</p>
          </div>
          <strong>${escapeHtml(formatCompactCurrency(settlement))}</strong>
        </div>
        <p><strong>Gross Amount:</strong> ${escapeHtml(formatCompactCurrency(gross))}</p>
        <p><strong>Yenkasa Commission:</strong> ${escapeHtml(formatCompactCurrency(commission))} <small>(10%)</small></p>
        <p><strong>Seller Settlement:</strong> ${escapeHtml(formatCompactCurrency(settlement))} <small>(90%)</small></p>
        <p><strong>Paystack Reference:</strong> ${escapeHtml(order.paystackReference || "-")}</p>
        <p><strong>Seller Subaccount:</strong> ${escapeHtml(order.sellerSubaccountCode || "-")}</p>
        <p><strong>Settlement Status:</strong> Handled by Paystack</p>
      </div>
    `;
  }).join("");
}

async function handleLogout() {
  try {
    const response = await fetch("https://www.yenkasa.xyz/triciabales-api/api/users/logout", {
      method: "POST",
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error("Logout request did not complete cleanly.");
    }
  } catch (error) {
    console.error(error);
  } finally {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedIn");
    window.location.href = "/store/admin-login";
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return;
  }

  document.exitFullscreen?.().catch(() => {});
}

function filterSidebarItems(query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  menuButtons.forEach(button => {
    const matches = !normalizedQuery || button.textContent.toLowerCase().includes(normalizedQuery);
    button.style.display = matches ? "" : "none";
  });
}

menuToggle?.addEventListener("click", openMenu);
dashboardMenuCloseBtn?.addEventListener("click", closeMenu);
adminLogoutBtn?.addEventListener("click", handleLogout);
adminNotificationsBtn?.addEventListener("click", () => showPanel("notifications"));
adminFullscreenBtn?.addEventListener("click", toggleFullscreen);
dashboardRefreshBtn?.addEventListener("click", loadDashboard);
dashboardSearchInput?.addEventListener("input", event => {
  filterSidebarItems(event.target.value);
});

document.addEventListener("click", event => {
  const panelButton = event.target.closest("[data-panel-link]");
  if (panelButton) {
    const target = panelButton.dataset.panelLink;
    if (target) {
      showPanel(target);
    }
  }

  if (!event.target.closest(".admin-sidebar") && !event.target.closest("#menuToggle") && window.innerWidth <= 960) {
    closeMenu();
  }
});

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
  const cancelButton = event.target.closest(".cancel-order-btn");
  if (cancelButton) {
    if (cancelButton.disabled) return;

    const orderId = cancelButton.dataset.id;
    if (!orderId) return;

    const confirmed = confirm("Cancel this unpaid order? Paid Paystack orders must be refunded instead.");
    if (!confirmed) return;

    try {
      cancelButton.disabled = true;
      cancelButton.textContent = "Cancelling...";

      const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "PUT",
        headers: getAuthHeaders()
      });
      const data = await readResponseData(response);

      if (isAuthFailure(response.status)) {
        handleUnauthorized(data);
        return;
      }

      if (!response.ok) {
        throw new Error(paymentApiErrorMessage(data, "Could not cancel order"));
      }

      alert(data?.message || "Order cancelled successfully.");
      await loadDashboard();
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to cancel order.");
      cancelButton.disabled = false;
      cancelButton.textContent = "Cancel Order";
    }
    return;
  }

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

    const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}/refund`, {
      method: "POST",
      headers: getJsonAuthHeaders(),
      body: JSON.stringify({ amount, reason: trimmedReason })
    });
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.error || "Could not record refund request");
    }

    alert("Refund request recorded. Review it from the Refunds tab.");
    await loadDashboard();
    showPanel("refunds");
  } catch (error) {
    console.error(error);
    alert(error.message || "Unable to record refund request.");
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

    const response = await fetch(`${API_BASE}/api/refunds/${encodeURIComponent(refundId)}/status`, {
      method: "PUT",
      headers: getJsonAuthHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.error || "Could not update refund status");
    }

    alert("Refund status updated.");
    await loadRefundRequests();
  } catch (error) {
    console.error(error);
    alert(error.message || "Unable to update refund status.");
    await loadRefundRequests();
  }
});

superAdminNotificationFilterBar?.addEventListener("click", event => {
  const button = event.target.closest("[data-notification-filter]");
  if (!button) return;

  activeSuperAdminNotificationFilter = button.dataset.notificationFilter || "all";
  superAdminNotificationFilterBar.querySelectorAll("[data-notification-filter]").forEach(filterButton => {
    filterButton.classList.toggle("active", filterButton === button);
  });
  renderSuperAdminNotifications(dashboardState.loadedSuperAdminNotifications);
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

usersList?.addEventListener("click", async event => {
  const resendButton = event.target.closest(".resend-verification-btn");
  if (resendButton) {
    const email = resendButton.dataset.email;
    if (!email) return;

    try {
      const response = await fetch("/triciabales-api/api/users/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await readResponseData(response);

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Could not resend verification email");
      }

      const message = data.actionUrl
        ? `${data.message}\n\nFallback verification link:\n${data.actionUrl}`
        : data.message;

      alert(message);
      return;
    } catch (error) {
      console.error(error);
      alert(error.message);
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

      const response = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      const data = await readResponseData(response);

      if (isAuthFailure(response.status)) {
        handleUnauthorized(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Could not delete account");
      }

      await loadUsers();
      return;
    } catch (error) {
      console.error(error);
      alert(error.message);
      return;
    }
  }

  const button = event.target.closest(".user-status-btn");
  if (!button) return;

  const userId = button.dataset.id;
  const status = button.dataset.status;
  if (!userId || !status) return;

  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}/status`, {
      method: "PUT",
      headers: getJsonAuthHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await readResponseData(response);

    if (isAuthFailure(response.status)) {
      handleUnauthorized(data);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Could not update account status");
    }

    await loadUsers();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});

function hydrateAdminIdentity() {
  adminAvatarLabel.textContent = initialsFromName(currentUser?.name, "SA");
  adminProfileSubtext.textContent = currentUser?.name || "Marketplace owner";
  dashboardDateFilterBtn.textContent = getWeekRangeLabel();
}

hydrateAdminIdentity();
showPanel("dashboard");
loadDashboard();
loadUsers();
loadStoreProfile();
