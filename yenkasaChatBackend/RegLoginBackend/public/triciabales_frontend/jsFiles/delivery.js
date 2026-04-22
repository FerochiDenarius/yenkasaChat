const radios = document.querySelectorAll('input[name="deliveryMethod"]');
const pickupDetails = document.getElementById("pickup-details");
const estimateStatus = document.getElementById("delivery-estimate-status");
const estimateDetails = document.getElementById("delivery-estimate-details");
const distanceText = document.getElementById("delivery-distance");
const feeText = document.getElementById("delivery-fee");
const API_BASE = "/triciabales-api";
let deliveryEstimate = null;

radios.forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.value === "pickup" && radio.checked) {
      pickupDetails.style.display = "block";
    } else if (radio.checked) {
      pickupDetails.style.display = "none";
    }
  });
});

document.getElementById("delivery-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const selected = document.querySelector(
    'input[name="deliveryMethod"]:checked'
  );

  if (!selected) {
    alert("Please choose a delivery method.");
    return;
  }

  if (selected.value !== "pickup" && !deliveryEstimate) {
    alert("Delivery estimate is not ready. Please check the address or try again.");
    return;
  }

  localStorage.setItem("deliveryMethod", selected.value);
  if (selected.value === "pickup") {
    localStorage.removeItem("deliveryEstimate");
  } else if (deliveryEstimate) {
    localStorage.setItem("deliveryEstimate", JSON.stringify(deliveryEstimate));
  }

  window.location.href = "/store/payment";
});

loadDeliveryEstimate();

async function loadDeliveryEstimate() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const addressData = JSON.parse(localStorage.getItem("checkoutAddress") || "{}");
  const authToken = localStorage.getItem("authToken") || "";

  if (!cart.length || !addressData.address || !authToken) {
    setEstimateError("Complete your cart and delivery address to see the delivery fee.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/delivery/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        address: addressData.address,
        region: addressData.region,
        area: addressData.area,
        landmark: addressData.landmark,
        items: cart.map(item => ({
          baleId: item.id,
          quantity: item.quantity
        }))
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || "Could not estimate delivery");
    }

    deliveryEstimate = data;
    localStorage.setItem("deliveryEstimate", JSON.stringify(data));
    estimateStatus.textContent = data.sellerCount > 1
      ? `Estimated from ${data.sellerCount} seller pickup points.`
      : "Estimated from seller shop to your address.";
    distanceText.textContent = `${Number(data.distanceKm || 0).toFixed(1)} km`;
    feeText.textContent = `GHS ${Number(data.deliveryFee || 0).toFixed(2)}`;
    estimateDetails.style.display = "block";
  } catch (err) {
    console.error(err);
    setEstimateError(err.message || "Unable to estimate delivery right now.");
  }
}

function setEstimateError(message) {
  deliveryEstimate = null;
  estimateStatus.textContent = message;
  estimateDetails.style.display = "none";
  localStorage.removeItem("deliveryEstimate");
}
