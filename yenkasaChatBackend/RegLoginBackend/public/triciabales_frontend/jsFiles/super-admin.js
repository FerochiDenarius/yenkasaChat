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
        <div class="super-admin-actions">
          <button class="manage-btn status release-payment-btn" data-id="${order.id}">
            Release Payment
          </button>
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
          <p>${order.sellerName || "Seller"} • ${order.customerName || "Customer"}</p>
        </div>
        <strong>GH₵${Number(order.total || 0).toFixed(2)}</strong>
      </div>
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

function renderSellers(orders) {
  const sellerMap = new Map();

  orders.forEach(order => {
    if (!order.sellerId) return;

    const existing = sellerMap.get(order.sellerId) || {
      sellerName: order.sellerName || "Seller",
      totalOrders: 0,
      totalSales: 0,
      pendingPayouts: 0
    };

    existing.totalOrders += 1;
    existing.totalSales += Number(order.total || 0);

    if (order.paymentStatus !== "payout_released") {
      existing.pendingPayouts += 1;
    }

    sellerMap.set(order.sellerId, existing);
  });

  const sellers = Array.from(sellerMap.values());

  if (!sellers.length) {
    renderEmpty(sellersList, "No seller activity yet.");
    return;
  }

  sellersList.innerHTML = sellers.map(seller => `
    <div class="super-admin-item">
      <div class="super-admin-item-header">
        <div>
          <strong>${seller.sellerName}</strong>
          <p>${seller.totalOrders} orders</p>
        </div>
        <strong>GH₵${seller.totalSales.toFixed(2)}</strong>
      </div>
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
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Verified:</strong> ${user.emailVerified ? "Yes" : "No"}</p>
        <p><strong>Phone:</strong> ${user.phone || "-"}</p>
        <p><strong>Suspended At:</strong> ${formatDateTime(user.suspendedAt)}</p>
        <p><strong>Blocked At:</strong> ${formatDateTime(user.blockedAt)}</p>
        <div class="super-admin-actions">
          <button class="manage-btn status user-status-btn" data-id="${user.id}" data-status="ACTIVE">
            Reactivate
          </button>
          <button class="manage-btn status user-status-btn" data-id="${user.id}" data-status="SUSPENDED" ${isSelf ? "disabled" : ""}>
            Suspend
          </button>
          <button class="manage-btn delete user-status-btn" data-id="${user.id}" data-status="BLOCKED" ${isSelf ? "disabled" : ""}>
            Block
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function loadDashboard() {
  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/orders",
      {
        headers: getAuthHeaders()
      }
    );
    const orders = await response.json();

    if (response.status === 401) {
      handleUnauthorized(orders);
      return;
    }

    if (!response.ok) {
      throw new Error("Could not load platform orders");
    }

    const pendingPayouts = orders.filter(order =>
      order.paymentStatus === "ready_for_payout" && order.confirmedByBuyer === true
    );
    const releasedPayouts = orders.filter(order => order.paymentStatus === "payout_released");
    const totalCommission = releasedPayouts.reduce(
      (sum, order) => sum + Number(order.commissionAmount || 0),
      0
    );

    document.getElementById("total-orders").textContent = orders.length;
    document.getElementById("ready-payouts").textContent = pendingPayouts.length;
    document.getElementById("commission-total").textContent = `GH₵${totalCommission.toFixed(2)}`;

    renderPendingPayoutItems(pendingPayoutsList, pendingPayouts);
    renderPendingPayoutItems(pendingPayoutsSectionList, pendingPayouts);
    renderAllOrders(orders);
    renderReleasedPayouts(releasedPayouts);
    renderSellers(orders);
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
      "https://www.yenkasa.xyz/triciabales-api/api/users",
      {
        headers: getAuthHeaders()
      }
    );
    const users = await response.json();

    if (response.status === 401) {
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
    const button = event.target.closest(".release-payment-btn");
    if (!button) return;

    const orderId = button.dataset.id;
    if (!orderId) return;

    try {
      const confirmed = confirm("Release seller payment after deducting 10% commission?");
      if (!confirmed) return;

      const response = await fetch(
        `https://www.yenkasa.xyz/triciabales-api/api/orders/${orderId}/status`,
        {
          method: "PUT",
          headers: getJsonAuthHeaders(),
          body: JSON.stringify({ releasePayout: "true" })
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized(data);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to release payout");
      }

      alert(
        `Seller payout released.\n\nCommission: GH₵${Number(data.commissionAmount || 0).toFixed(2)}\nSeller Gets: GH₵${Number(data.sellerPayoutAmount || 0).toFixed(2)}`
      );

      loadDashboard();
    } catch (err) {
      console.error(err);
      alert("Unable to release payout.");
    }
  });
}

attachReleaseHandler(pendingPayoutsList);
attachReleaseHandler(pendingPayoutsSectionList);

usersList.addEventListener("click", async event => {
  const button = event.target.closest(".user-status-btn");
  if (!button) return;

  const userId = button.dataset.id;
  const status = button.dataset.status;
  if (!userId || !status) return;

  try {
    const response = await fetch(
      `https://www.yenkasa.xyz/triciabales-api/api/users/${userId}/status`,
      {
        method: "PUT",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (response.status === 401) {
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
