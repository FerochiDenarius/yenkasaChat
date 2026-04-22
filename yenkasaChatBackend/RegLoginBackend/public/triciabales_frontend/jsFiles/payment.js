const paymentOptions = document.querySelectorAll(".payment-option");
const momoDetails = document.getElementById("momo-details");
const cardDetails = document.getElementById("card-details");
const bankDetails = document.getElementById("bank-details");
const paymentForm = document.getElementById("payment-form");
const API_BASE = "/triciabales-api";

renderPaymentSummary();

paymentOptions.forEach(option => {
  option.addEventListener("click", () => {
    const radio = option.querySelector('input[name="paymentMethod"]');

    paymentOptions.forEach(opt => opt.classList.remove("active"));
    option.classList.add("active");

    if (radio) {
      radio.checked = true;
    }

    const method = option.dataset.method;

    momoDetails.classList.add("hidden");
    cardDetails.classList.add("hidden");
    bankDetails.classList.add("hidden");

    if (method === "momo") {
      momoDetails.classList.remove("hidden");
    }

    if (method === "card") {
      cardDetails.classList.remove("hidden");
    }

    if (method === "bank") {
      bankDetails.classList.remove("hidden");
    }
  });
});

paymentForm.addEventListener("submit", async e => {
  e.preventDefault();

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const addressData = JSON.parse(localStorage.getItem("checkoutAddress") || "{}");
  const deliveryMethod = localStorage.getItem("deliveryMethod");
  const deliveryEstimate = JSON.parse(localStorage.getItem("deliveryEstimate") || "null");
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  const authToken = localStorage.getItem("authToken") || "";
  const submitButton = paymentForm.querySelector('button[type="submit"]');
  const selectedPaymentMethod = document.querySelector(
    'input[name="paymentMethod"]:checked'
  )?.value;

  if (!currentUser?.id || !authToken) {
    alert("Please login before checkout.");
    window.location.href = "/store/buyer-login";
    return;
  }

  if (!cart.length) {
    alert("Your cart is empty.");
    window.location.href = "/store/cart";
    return;
  }

  if (!addressData.customerName || !addressData.phone || !addressData.address) {
    alert("Please complete your delivery address first.");
    window.location.href = "/store/address";
    return;
  }

  if (!deliveryMethod) {
    alert("Please select a delivery method first.");
    window.location.href = "/store/delivery";
    return;
  }

  if (!selectedPaymentMethod) {
    alert("Please select a payment method");
    return;
  }

  if (selectedPaymentMethod === "momo") {
    const momoNetwork = document.getElementById("momo-network")?.value?.trim();
    const momoNumber = document.getElementById("momo-number")?.value?.trim();

    if (!momoNetwork || !momoNumber) {
      alert("Please enter your mobile money network and number.");
      return;
    }
  }

  if (selectedPaymentMethod === "card") {
    const cardEmail = document.getElementById("card-email")?.value?.trim();

    if (!cardEmail) {
      alert("Please enter the email to use for card payment.");
      return;
    }
  }

  const payload = {
    customerName: addressData.customerName,
    phone: addressData.phone,
    address: addressData.address,
    region: addressData.region,
    area: addressData.area,
    landmark: addressData.landmark,
    notes: addressData.notes,
    deliveryMethod,
    deliveryAddress: deliveryEstimate?.buyerAddress || null,
    deliveryDistanceKm: deliveryMethod === "pickup" ? null : deliveryEstimate?.distanceKm || null,
    deliveryFee: deliveryMethod === "pickup" ? 0 : deliveryEstimate?.deliveryFee || 0,
    paymentMethod: selectedPaymentMethod,
    paymentStatus:
      selectedPaymentMethod === "cash"
        ? "pending"
        : selectedPaymentMethod === "bank"
          ? "awaiting_transfer"
          : "awaiting_payment",
    userId: currentUser ? currentUser.id : null,
    momoNumber: document.getElementById("momo-number")?.value || null,
    momoNetwork: document.getElementById("momo-network")?.value || null,
    cardEmail: document.getElementById("card-email")?.value || null,
    items: cart.map(item => ({
      baleId: item.id,
      baleName: item.name,
      price: item.price,
      quantity: item.quantity
    }))
  };

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = selectedPaymentMethod === "card" || selectedPaymentMethod === "momo"
        ? "Preparing Secure Payment..."
        : "Placing Order...";
    }

    const response = await fetch(
      `${API_BASE}/api/orders/checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Order failed");
    }

    if (selectedPaymentMethod === "card" || selectedPaymentMethod === "momo") {
      const paystackResponse = await fetch(`${API_BASE}/api/paystack/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          orderId: data.id,
          email: document.getElementById("card-email")?.value?.trim() || currentUser.email
        })
      });

      const paystackData = await paystackResponse.json();

      if (!paystackResponse.ok) {
        throw new Error(paystackData.error || paystackData.message || "Could not start Paystack payment");
      }

      if (!paystackData.authorizationUrl) {
        throw new Error("Paystack did not return a payment URL");
      }

      localStorage.setItem("lastOrder", JSON.stringify(data));
      localStorage.setItem("pendingPaystackOrderId", String(data.id));
      localStorage.setItem("pendingPaystackReference", paystackData.reference);

      window.location.href = paystackData.authorizationUrl;
      return;
    }

    localStorage.removeItem("cart");
    localStorage.removeItem("checkoutAddress");
    localStorage.removeItem("deliveryMethod");
    localStorage.removeItem("deliveryEstimate");

    localStorage.setItem("lastOrder", JSON.stringify(data));

    window.location.href = "/store/thank-you";
  } catch (err) {
    console.error(err);
    alert(err.message || "Could not place order. Please try again.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Place Order";
    }
  }
});

function renderPaymentSummary() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const deliveryMethod = localStorage.getItem("deliveryMethod");
  const deliveryEstimate = JSON.parse(localStorage.getItem("deliveryEstimate") || "null");
  const productTotal = cart.reduce((sum, item) => {
    return sum + (Number(item.price || 0) * Number(item.quantity || 1));
  }, 0);
  const deliveryFee = deliveryMethod === "pickup" ? 0 : Number(deliveryEstimate?.deliveryFee || 0);
  const total = productTotal + deliveryFee;

  document.getElementById("summary-products").textContent = money(productTotal);
  document.getElementById("summary-delivery").textContent = money(deliveryFee);
  document.getElementById("summary-total").textContent = money(total);
}

function money(amount) {
  return `GHS ${Number(amount || 0).toFixed(2)}`;
}
