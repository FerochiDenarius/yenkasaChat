const paymentOptions = document.querySelectorAll(".payment-option");
const momoDetails = document.getElementById("momo-details");
const cardDetails = document.getElementById("card-details");
const bankDetails = document.getElementById("bank-details");
const paymentForm = document.getElementById("payment-form");

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
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  const submitButton = paymentForm.querySelector('button[type="submit"]');
  const selectedPaymentMethod = document.querySelector(
    'input[name="paymentMethod"]:checked'
  )?.value;

  if (!currentUser?.id) {
    alert("Please login before checkout.");
    window.location.href = "buyer-login.html";
    return;
  }

  if (!cart.length) {
    alert("Your cart is empty.");
    window.location.href = "cart.html";
    return;
  }

  if (!addressData.customerName || !addressData.phone || !addressData.address) {
    alert("Please complete your delivery address first.");
    window.location.href = "address.html";
    return;
  }

  if (!deliveryMethod) {
    alert("Please select a delivery method first.");
    window.location.href = "delivery.html";
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
      submitButton.textContent = "Placing Order...";
    }

    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/orders/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Order failed");
    }

    localStorage.removeItem("cart");
    localStorage.removeItem("checkoutAddress");
    localStorage.removeItem("deliveryMethod");

    localStorage.setItem("lastOrder", JSON.stringify(data));

    window.location.href = "thank-you.html";
  } catch (err) {
    console.error(err);
    alert("Could not place order. Please try again.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Place Order";
    }
  }
});
