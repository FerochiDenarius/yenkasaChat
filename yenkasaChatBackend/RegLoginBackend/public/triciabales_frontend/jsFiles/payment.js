const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
const momoDetails = document.getElementById("momo-details");

paymentRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.value === "cash") {
      momoDetails.style.display = "none";
    } else {
      momoDetails.style.display = "block";
    }
  });
});

document.getElementById("payment-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const addressData = JSON.parse(localStorage.getItem("checkoutAddress") || "{}");
  const deliveryMethod = localStorage.getItem("deliveryMethod");

  const selectedPayment = document.querySelector(
    'input[name="paymentMethod"]:checked'
  );

  if (!selectedPayment) {
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

    deliveryMethod: deliveryMethod,
    paymentMethod: selectedPayment.value,

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
