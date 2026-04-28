const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const feedback = document.getElementById("orders-feedback");
const ordersContainer = document.getElementById("orders-container");

document.querySelectorAll("[data-menu-close]").forEach(button => {
  button.addEventListener("click", () => {
    button.closest(".dashboard-menu")?.classList.add("menu-closed");
  });
});

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${authToken}`
  };
}

function setFeedback(message, actionHtml = "") {
  feedback.classList.remove("hidden");
  feedback.innerHTML = `
    <div class="card">
      <div class="card-content">
        <h3>${message}</h3>
        ${actionHtml}
      </div>
    </div>
  `;
}

function getStatusClass(type, value) {
  const normalized = (value || "").toLowerCase();

  if (type === "payment") {
    if (normalized === "paid") return "paid";
    if (
      normalized === "awaiting_payment" ||
      normalized === "awaiting_transfer"
    ) {
      return "awaiting";
    }
    return "unpaid";
  }

  if (normalized === "delivered" || normalized === "completed") {
    return "paid";
  }

  if (normalized === "shipped" || normalized === "processing") {
    return "awaiting";
  }

  return "unpaid";
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderOrders(orders) {
  ordersContainer.innerHTML = orders.map(order => `
    <article class="order-card">
      <div class="order-card-top">
        <div>
          <p class="order-label">Order #${order.id}</p>
          <h3>${order.customerName || "Customer Order"}</h3>
        </div>

        <div class="order-total">GHS ${order.total ?? "-"}</div>
      </div>

      <div class="order-meta">
        <span class="status-pill ${getStatusClass("payment", order.paymentStatus)}">
          Payment: ${formatStatus(order.paymentStatus)}
        </span>
        <span class="status-pill ${getStatusClass("delivery", order.deliveryStatus)}">
          Delivery: ${formatStatus(order.deliveryStatus)}
        </span>
      </div>

      <div class="order-details">
        <p><strong>Payment Method:</strong> ${formatStatus(order.paymentMethod)}</p>
        <p><strong>Delivery Method:</strong> ${formatStatus(order.deliveryMethod)}</p>
        <p><strong>Address:</strong> ${order.address || "-"}</p>
        <p><strong>Buyer Confirmation:</strong> ${order.confirmedByBuyer ? "Confirmed" : "Pending"}</p>
      </div>

      <div class="order-items">
        <h4>Items</h4>
        <div class="order-item-list">
          ${(order.items || []).map(item => `
            <div class="order-item-row">
              <span>${item.baleName}${item.selectedSize ? ` (${item.selectedSize})` : ""}</span>
              <span>${item.quantity} x GHS ${item.price}</span>
            </div>
          `).join("")}
        </div>
      </div>

      ${order.deliveryStatus === "delivered" && !order.confirmedByBuyer ? `
        <div class="order-confirm">
          <button class="confirm-received-btn" data-id="${order.id}">
            I Have Received My Order
          </button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

ordersContainer.addEventListener("click", async event => {
  const button = event.target.closest(".confirm-received-btn");

  if (!button) {
    return;
  }

  const orderId = button.dataset.id;

  if (!orderId) {
    return;
  }

  try {
    const confirmed = confirm(
      "Confirm that you have received this order? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(
      `https://www.yenkasa.xyz/triciabales-api/api/orders/${orderId}/confirm-received`,
      {
        method: "PUT",
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error("Could not confirm order");
    }

    alert("Thank you. Seller payment is now ready for release.");
    loadOrders();
  } catch (err) {
    console.error(err);
    alert("Could not confirm this order.");
  }
});

async function loadOrders() {
  if (!currentUser?.id || !authToken) {
    setFeedback(
      "Please login to view your orders.",
      '<p><a href="/store/buyer-login" class="primary-btn">Login</a></p>'
    );
    return;
  }

  try {
    const response = await fetch(
      `https://www.yenkasa.xyz/triciabales-api/api/orders/user/${currentUser.id}`,
      {
        headers: getAuthHeaders()
      }
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load orders");
    }

    if (!Array.isArray(data) || data.length === 0) {
      setFeedback(
        "You have not placed any orders yet.",
        '<p><a href="/store" class="primary-btn">Start Shopping</a></p>'
      );
      return;
    }

    feedback.classList.add("hidden");
    renderOrders(data);
  } catch (err) {
    console.error(err);
    setFeedback("Could not load your orders right now. Please try again later.");
  }
}

loadOrders();
