const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const logoutLink = document.getElementById("logoutLink");
const registerLink = document.getElementById("registerLink");
const buyerLoginLink = document.getElementById("buyerLoginLink");

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function updateHomepageNav() {
  if (!logoutLink) {
    return;
  }

  if (currentUser) {
    logoutLink.classList.remove("hidden-nav-link");
    registerLink?.classList.add("hidden-nav-link");
    buyerLoginLink?.classList.add("hidden-nav-link");
    return;
  }

  logoutLink.classList.add("hidden-nav-link");
  registerLink?.classList.remove("hidden-nav-link");
  buyerLoginLink?.classList.remove("hidden-nav-link");
}

async function logout() {
  const authToken = localStorage.getItem("authToken");

  try {
    if (authToken) {
      await fetch("https://www.yenkasa.xyz/triciabales-api/api/users/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("checkoutAddress");
    localStorage.removeItem("deliveryMethod");
    localStorage.removeItem("lastOrder");
    window.location.href = "/store";
  }
}

logoutLink?.addEventListener("click", event => {
  event.preventDefault();
  logout();
});

updateHomepageNav();

function addToCart(item) {
  const cart = getCart();

  const existing = cart.find(cartItem => cartItem.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      quantity: 1
    });
  }

  saveCart(cart);

  alert(`${item.name} added to cart`);
}

fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales")
  .then(res => res.json())
  .then(data => {
    const baleContainer = document.getElementById("bale-container");
    const dressContainer = document.getElementById("dress-container");

    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        ${item.imageUrl ? `
          <div class="product-image-wrap">
            <img
              src="${item.imageUrl}"
              alt="${item.name}"
              class="product-image"
            >
          </div>
        ` : ""}

        <div class="card-content">
          <div class="card-top">
            <h3>${item.name}</h3>
            <span class="status ${item.status}">${item.status}</span>
          </div>

          <p>${item.description}</p>

          <div class="price">GHS ${item.price}</div>

          <p>
            <strong>${item.type === "single" ? "Size" : "Weight"}:</strong>
            ${item.weight}
          </p>

          ${item.videoUrl
            ? `<video controls src="${item.videoUrl}"></video>`
            : ""}

          ${item.status !== "sold"
            ? `
              <div class="card-actions">
                <button class="add-cart-btn">🛒 Add to Cart</button>

                <a href="https://wa.me/233551699010?text=Hello%20Tricia,%20I%20am%20interested%20in%20${encodeURIComponent(item.name)}" target="_blank">
                  <button>💬 Chat on WhatsApp</button>
                </a>
              </div>
            `
            : `
              <button disabled>Sold Out</button>
            `}
        </div>
      `;

      const productImage = card.querySelector(".product-image");
      const addCartBtn = card.querySelector(".add-cart-btn");

      if (productImage) {
        productImage.addEventListener("click", () => {
          openImage(item.imageUrl);
        });
      }

      if (addCartBtn) {
        addCartBtn.addEventListener("click", () => {
          addToCart(item);
        });
      }

      if (item.type === "single") {
        dressContainer.appendChild(card);
      } else {
        baleContainer.appendChild(card);
      }
    });
  })
  .catch(err => {
    console.error(err);

    const errorHtml = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;background:white;border-radius:20px;">
        <h3>Unable to load products</h3>
        <p>Please check that the server is running.</p>
      </div>
    `;

    document.getElementById("bale-container").innerHTML = errorHtml;
    document.getElementById("dress-container").innerHTML = errorHtml;
  });

imageModal.addEventListener("click", event => {
  if (event.target === imageModal) {
    closeImage();
  }
});

function openImage(src) {
  modalImage.src = src;
  imageModal.style.display = "flex";
}

function closeImage() {
  imageModal.style.display = "none";
}
