const radios = document.querySelectorAll('input[name="deliveryMethod"]');
const pickupDetails = document.getElementById("pickup-details");

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

  localStorage.setItem("deliveryMethod", selected.value);

  window.location.href = "payment.html";
});
