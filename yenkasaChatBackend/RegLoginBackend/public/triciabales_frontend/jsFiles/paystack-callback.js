const statusBox = document.getElementById("paystack-callback-status");
const params = new URLSearchParams(window.location.search);
const reference = params.get("reference") || params.get("trxref");

function renderStatus(title, message, actions = "") {
  statusBox.innerHTML = `
    <h3>${title}</h3>
    <p style="margin-top:10px;">${message}</p>
    ${actions}
  `;
}

async function verifyPayment() {
  if (!reference) {
    renderStatus(
      "Payment Reference Missing",
      "We could not find a Paystack reference in this return URL.",
      `<p style="margin-top:18px;"><a href="/store/orders" class="primary-btn">View Orders</a></p>`
    );
    return;
  }

  try {
    const response = await fetch(
      `/triciabales-api/api/paystack/verify?reference=${encodeURIComponent(reference)}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Payment verification failed");
    }

    if (data.paid) {
      localStorage.removeItem("cart");
      localStorage.removeItem("checkoutAddress");
      localStorage.removeItem("deliveryMethod");

      if (data.order) {
        localStorage.setItem("lastOrder", JSON.stringify(data.order));
      }

      renderStatus(
        "Payment Successful",
        `Your payment has been confirmed for order #${data.orderId}.`,
        `
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;">
            <a href="/store/thank-you" class="primary-btn">View Receipt</a>
            <a href="/store/orders" class="secondary-btn">My Orders</a>
          </div>
        `
      );
      return;
    }

    renderStatus(
      "Payment Not Completed",
      "Paystack did not return a successful payment status for this transaction.",
      `<p style="margin-top:18px;"><a href="/store/payment" class="primary-btn">Try Again</a></p>`
    );
  } catch (error) {
    console.error(error);
    renderStatus(
      "Could Not Verify Payment",
      error.message,
      `<p style="margin-top:18px;"><a href="/store/orders" class="primary-btn">View Orders</a></p>`
    );
  }
}

verifyPayment();
