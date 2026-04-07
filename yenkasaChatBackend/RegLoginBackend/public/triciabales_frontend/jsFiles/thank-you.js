const order = JSON.parse(localStorage.getItem("lastOrder") || "null");
const summary = document.getElementById("order-summary");

if (!summary) {
  throw new Error("Order summary container not found");
}

if (!order) {
  summary.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <p><strong>No recent order found.</strong></p>
      <p>Please place an order first, or return to the shop.</p>
    </div>
  `;
} else {
  summary.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <p><strong>Order ID:</strong> #${order.id ?? "-"}</p>
      <p><strong>Name:</strong> ${order.customerName || "-"}</p>
      <p><strong>Total:</strong> GHS ${order.total ?? "-"}</p>
      <p><strong>Payment Method:</strong> ${order.paymentMethod || "-"}</p>
      <p><strong>Payment Status:</strong> ${order.paymentStatus || "-"}</p>
      <p><strong>Delivery Method:</strong> ${order.deliveryMethod || "-"}</p>
      <p><strong>Delivery Status:</strong> ${order.deliveryStatus || "-"}</p>
    </div>
  `;
}
