const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const menuToggle = document.getElementById("menuToggle");
const dashboardMenu = document.getElementById("dashboardMenu");
const menuButtons = document.querySelectorAll(".dashboard-menu .tab-btn");
const panels = document.querySelectorAll(".super-admin-panel");
const pendingPayoutsList = document.getElementById("pendingPayoutsList");
const pendingPayoutsSectionList = document.getElementById("pendingPayoutsSectionList");
const allOrdersList = document.getElementById("allOrdersList");
const releasedPayoutsList = document.getElementById("releasedPayoutsList");
const sellersList = document.getElementById("sellersList");
const usersList = document.getElementById("usersList");
const API_BASE = "/triciabales-api";

if (!currentUser || currentUser.role !== "SUPER_ADMIN" || !authToken) {
  window.location.href = "buyer-login.html";
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
  window.location.href = "login.html";
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
}

function renderEmpty(target, message) {
  target.innerHTML = `<p>${message}</p>`;
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
        <p><strong>Buyer Confirmed:</strong> ${order.confirmedByBuyer ? "Yes" : "No"}</p>
        <p><strong>Total:</strong> GH₵${total.toFixed(2)}</p>
        <p><strong>Commission:</strong> GH₵${commission.toFixed(2)}</p>
        <p><strong>Seller Receives:</strong> GH₵${sellerReceives.toFixed(2)}</p>
        <p><strong>Payout Status:</strong> ${formatStatus(order.paymentStatus)}</p>
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

  allOrdersList.innerHTML = orders.map(order => `
    <div class="super-admin-item">
      <div class="super-admin-item-header">
        <div>
          <strong>Order #${order.id}</strong>
          <p>${order.sellerName || "Seller"} • ${order.buyerName || order.customerName || "Customer"}</p>
        </div>
        <strong>GH₵${Number(order.total || 0).toFixed(2)}</strong>
      </div>
      <p><strong>Seller ID:</strong> ${order.sellerId || "-"}</p>
      <p><strong>Buyer ID:</strong> ${order.buyerId || "-"}</p>
      <p><strong>Buyer:</strong> ${order.buyerName || order.customerName || "-"}</p>
      <p><strong>Buyer Email:</strong> ${order.buyerEmail || "-"}</p>
      <p><strong>Payment:</strong> ${formatStatus(order.paymentStatus)}</p>
      <p><strong>Delivery:</strong> ${formatStatus(order.deliveryStatus)}</p>
      <p><strong>Buyer Confirmed:</strong> ${order.confirmedByBuyer ? "Yes" : "No"}</p>
    </div>
  `).join("");
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

async function loadDashboard() {
  try {
    const [ordersResponse, sellersResponse] = await Promise.all([
      fetch(
        `${API_BASE}/api/orders`,
        {
          headers: getAuthHeaders()
        }
      ),
      fetch(
        `${API_BASE}/api/users/sellers`,
        {
          headers: getAuthHeaders()
        }
      )
    ]);
    const [orders, sellers] = await Promise.all([
      ordersResponse.json(),
      sellersResponse.json()
    ]);

    if (isAuthFailure(ordersResponse.status)) {
      handleUnauthorized(orders);
      return;
    }

    if (isAuthFailure(sellersResponse.status)) {
      handleUnauthorized(sellers);
      return;
    }

    if (!ordersResponse.ok) {
      throw new Error("Could not load platform orders");
    }

    if (!sellersResponse.ok) {
      throw new Error(sellers.message || sellers.error || "Could not load seller accounts");
    }

    const readyPayouts = orders.filter(order =>
      order.paymentStatus === "ready_for_payout" && order.confirmedByBuyer === true
    );
    const pendingPayouts = orders.filter(order =>
      (order.paymentStatus === "ready_for_payout" || order.paymentStatus === "payout_on_hold")
      && order.confirmedByBuyer === true
    );
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
  } catch (err) {
    console.error(err);
    renderEmpty(pendingPayoutsList, "Unable to load dashboard.");
    renderEmpty(pendingPayoutsSectionList, "Unable to load pending payouts.");
    renderEmpty(allOrdersList, "Unable to load orders.");
    renderEmpty(releasedPayoutsList, "Unable to load released payouts.");
    renderEmpty(sellersList, "Unable to load sellers.");
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

menuButtons.forEach(button => {
  button.addEventListener("click", () => {
    showPanel(button.dataset.panel);
  });
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
