function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function removeFromCart(id) {
  const cart = getCart().filter(item => item.id !== id);
  saveCart(cart);
  renderCart();
}

function renderCart() {
  const cart = getCart();

  const cartItems = document.getElementById("cart-items");
  const cartSummary = document.getElementById("cart-summary");
  const cartTotal = document.getElementById("cart-total");

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="card">
        <div class="card-content">
          <h3>Your cart is empty</h3>
          <p>Add some dresses or bales first.</p>
        </div>
      </div>
    `;

    cartSummary.style.display = "none";
    return;
  }

  let total = 0;

  cartItems.innerHTML = cart.map(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    return `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-content">
          <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">

            <img
              src="${item.imageUrl}"
              style="width:120px; height:120px; object-fit:cover; border-radius:14px;"
            >

            <div style="flex:1;">
              <h3>${item.name}</h3>
              <p>Quantity: ${item.quantity}</p>
              <p>Price: GHS ${item.price}</p>
              <p><strong>Subtotal: GHS ${subtotal}</strong></p>
            </div>

            <button class="remove-cart-btn" data-id="${item.id}">
              Remove
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  cartTotal.textContent = `Total: GHS ${total}`;
  cartSummary.style.display = "block";
}

document.addEventListener("click", event => {
  const removeBtn = event.target.closest(".remove-cart-btn");

  if (!removeBtn) {
    return;
  }

  removeFromCart(Number(removeBtn.dataset.id));
});

renderCart();

const checkoutBtn = document.getElementById("checkout-btn");

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    if (!currentUser) {
      alert("Please login or register before checkout.");
      window.location.href = "buyer-login.html";
      return;
    }

    window.location.href = "address.html";
  });
}
