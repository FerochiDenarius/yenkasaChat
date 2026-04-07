const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

if (currentUser) {
  document.getElementById("customerName").value = currentUser.name || "";
  document.getElementById("phone").value = currentUser.phone || "";
  document.getElementById("address").value = currentUser.address || "";
}

document.getElementById("address-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    customerName: document.getElementById("customerName").value,
    phone: document.getElementById("phone").value,
    region: document.getElementById("region").value,
    area: document.getElementById("area").value,
    landmark: document.getElementById("landmark").value,
    address: document.getElementById("address").value,
    notes: document.getElementById("notes").value
  };

  localStorage.setItem("checkoutAddress", JSON.stringify(data));

  window.location.href = "delivery.html";
});
