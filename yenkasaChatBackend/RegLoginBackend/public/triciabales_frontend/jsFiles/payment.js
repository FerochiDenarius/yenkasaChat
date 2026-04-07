const paymentOptions = document.querySelectorAll(".payment-option");
const momoDetails = document.getElementById("momo-details");
const cardDetails = document.getElementById("card-details");
const bankDetails = document.getElementById("bank-details");

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

document.getElementById("payment-form").addEventListener("submit", async e => {
  e.preventDefault();

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const addressData = JSON.parse(localStorage.getItem("checkoutAddress") || "{}");
  const deliveryMethod = localStorage.getItem("deliveryMethod");
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  const selectedPaymentMethod = document.querySelector(
    'input[name="paymentMethod"]:checked'
  )?.value;

  if (!selectedPaymentMethod) {
    alert("Please select a payment method");
    return;
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
  }
});
