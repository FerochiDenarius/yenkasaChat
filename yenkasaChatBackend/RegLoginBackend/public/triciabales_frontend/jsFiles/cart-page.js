function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function optimizeCloudinaryImage(url, width = 300) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  if (/\/image\/upload\/[^/]*(f_auto|q_auto|w_)/.test(url)) return url;
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
}

function removeFromCart(cartKey) {
  const cart = getCart().filter(item => (item.cartKey || String(item.id)) !== cartKey);
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
              src="${optimizeCloudinaryImage(item.imageUrl, 300)}"
              loading="lazy"
              decoding="async"
              style="width:120px; height:120px; object-fit:cover; border-radius:14px;"
            >

            <div style="flex:1;">
              <h3>${item.name}</h3>
              ${item.selectedSize ? `<p>Size: ${item.selectedSize}</p>` : ""}
              <p>Quantity: ${item.quantity}</p>
              <p>Price: GHS ${item.price}</p>
              <p><strong>Subtotal: GHS ${subtotal}</strong></p>
            </div>

            <button class="remove-cart-btn" data-key="${item.cartKey || item.id}">
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

  removeFromCart(String(removeBtn.dataset.key));
});

renderCart();

const checkoutBtn = document.getElementById("checkout-btn");

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    if (!currentUser) {
      alert("Please login or register before checkout.");
      window.location.href = "/store/buyer-login";
      return;
    }

    window.location.href = "/store/address";
  });
}
