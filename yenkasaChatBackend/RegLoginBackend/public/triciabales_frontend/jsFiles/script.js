const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const logoutLink = document.getElementById("logoutLink");
const registerLink = document.getElementById("registerLink");
const buyerLoginLink = document.getElementById("buyerLoginLink");
const featuredContainer = document.getElementById("featured-container");
const siteSearch = document.getElementById("siteSearch");
const searchBtn = document.getElementById("searchBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mainNav = document.getElementById("mainNav");
const promoSlides = document.querySelectorAll(".promo-slide");
let allProducts = [];
let currentPromoIndex = 0;

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

mobileMenuBtn?.addEventListener("click", () => {
  mainNav?.classList.toggle("open");
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
  });
});

function rotatePromoSlides() {
  if (!promoSlides.length) {
    return;
  }

  promoSlides.forEach((slide, index) => {
    slide.classList.toggle("active", index === currentPromoIndex);
  });

  currentPromoIndex = (currentPromoIndex + 1) % promoSlides.length;
}

rotatePromoSlides();
setInterval(rotatePromoSlides, 4000);

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

function getInitials(name) {
  return String(name || "YS")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("") || "YS";
}

function normalizeWhatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("233")) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length >= 10) {
    return `233${digits.slice(1)}`;
  }

  return digits;
}

function renderSellerAvatar(item) {
  if (item.sellerProfileImageUrl) {
    return `<img src="${item.sellerProfileImageUrl}" alt="${item.sellerName || "Seller"}">`;
  }

  return `<span>${getInitials(item.sellerName)}</span>`;
}

function getProductCategory(item) {
  const type = String(item.type || "").toLowerCase();
  const category = String(item.category || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  const combined = `${type} ${category} ${name}`;

  if (type === "single" || combined.includes("dress")) {
    return "dress";
  }

  if (combined.includes("fabric") || combined.includes("textile") || combined.includes("material")) {
    return "fabric";
  }

  if (
    combined.includes("accessory") ||
    combined.includes("bag") ||
    combined.includes("shoe") ||
    combined.includes("jewelry") ||
    combined.includes("cosmetic")
  ) {
    return "accessory";
  }

  return "bale";
}

function getEmptyCategoryCard(title, message) {
  return `
    <div class="coming-category-card compact">
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
}

function createProductCard(item) {
  const card = document.createElement("div");
  card.className = "card marketplace-product-card";
  const sellerName = item.sellerName || "Yenkasa Seller";
  const whatsappNumber = normalizeWhatsappNumber(item.sellerPhone);
  const whatsappMessage = encodeURIComponent(`Hello ${sellerName}, I am interested in ${item.name}`);
  const productCategory = getProductCategory(item);
  const categoryLabel = productCategory.charAt(0).toUpperCase() + productCategory.slice(1);
  const status = String(item.status || "available").toLowerCase();

  card.innerHTML = `
    ${item.imageUrl ? `
      <div class="product-image-wrap">
        <img
          src="${item.imageUrl}"
          alt="${item.name || "Yenkasa Store product"}"
          class="product-image"
        >
      </div>
    ` : `
      <div class="product-image-wrap product-image-placeholder">
        <span>${categoryLabel}</span>
      </div>
    `}

    <div class="card-content">
      <div class="seller-mini-profile">
        <div class="seller-avatar">
          ${renderSellerAvatar(item)}
        </div>
        <div>
          <strong>${sellerName}</strong>
          <small>${item.sellerPhone ? "Seller on Yenkasa Store" : "Seller WhatsApp not added"}</small>
        </div>
      </div>

      <div class="card-top">
        <h3>${item.name || "Untitled Product"}</h3>
        <span class="status ${status}">${status}</span>
      </div>

      <p>${item.description || "No description available."}</p>

      <div class="product-meta-line">
        <span class="product-chip">${categoryLabel}</span>
        <span class="product-chip">${item.weight || item.size || "Details pending"}</span>
        <span class="product-chip">${item.category || "General"}</span>
      </div>

      <div class="price">GHS ${item.price || 0}</div>

      ${item.videoUrl
        ? `<video controls src="${item.videoUrl}"></video>`
        : ""}

      ${status !== "sold"
        ? `
          <div class="card-actions">
            <button class="add-cart-btn">Add to Cart</button>

            ${whatsappNumber
              ? `
                <a href="https://wa.me/${whatsappNumber}?text=${whatsappMessage}" target="_blank">
                  <button>Chat with Seller</button>
                </a>
              `
              : `<button type="button" disabled>WhatsApp unavailable</button>`}
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

  return card;
}

function clearContainer(container) {
  if (container) {
    container.innerHTML = "";
  }
}

function renderIntoContainer(container, products, emptyTitle, emptyMessage) {
  if (!container) {
    return;
  }

  clearContainer(container);

  if (!products.length) {
    container.innerHTML = getEmptyCategoryCard(emptyTitle, emptyMessage);
    return;
  }

  products.forEach(item => {
    container.appendChild(createProductCard(item));
  });
}

function renderMarketplaceProducts(products) {
  const baleContainer = document.getElementById("bale-container");
  const dressContainer = document.getElementById("dress-container");
  const fabricContainer = document.getElementById("fabric-container");
  const accessoryContainer = document.getElementById("accessory-container");
  const availableProducts = products.filter(item => String(item.status || "").toLowerCase() !== "sold");
  const categoryGroups = {
    bale: products.filter(item => getProductCategory(item) === "bale"),
    dress: products.filter(item => getProductCategory(item) === "dress"),
    fabric: products.filter(item => getProductCategory(item) === "fabric"),
    accessory: products.filter(item => getProductCategory(item) === "accessory")
  };

  renderIntoContainer(
    featuredContainer,
    availableProducts.slice(0, 6),
    "No featured products yet",
    "Active products will appear here as sellers upload more items."
  );

  renderIntoContainer(
    baleContainer,
    categoryGroups.bale,
    "No bales available yet",
    "Bale listings will appear here as sellers upload them."
  );

  renderIntoContainer(
    dressContainer,
    categoryGroups.dress,
    "No dresses available yet",
    "Dress listings will appear here as sellers upload them."
  );

  renderIntoContainer(
    fabricContainer,
    categoryGroups.fabric,
    "Fabric listings coming soon",
    "This section is ready for textile and material sellers."
  );

  renderIntoContainer(
    accessoryContainer,
    categoryGroups.accessory,
    "Accessories section ready",
    "Bags, beauty items, shoes and other accessories can appear here later."
  );
}

function applySearch() {
  const query = String(siteSearch?.value || "").trim().toLowerCase();

  if (!query) {
    renderMarketplaceProducts(allProducts);
    return;
  }

  const filtered = allProducts.filter(item => {
    return [
      item.name,
      item.description,
      item.category,
      item.status,
      item.weight,
      item.size,
      item.sellerName,
      item.type
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  renderMarketplaceProducts(filtered);
}

searchBtn?.addEventListener("click", applySearch);
siteSearch?.addEventListener("input", applySearch);

fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales")
  .then(res => res.json())
  .then(data => {
    allProducts = Array.isArray(data) ? data : [];
    renderMarketplaceProducts(allProducts);
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
    document.getElementById("fabric-container").innerHTML = errorHtml;
    document.getElementById("accessory-container").innerHTML = errorHtml;
    if (featuredContainer) {
      featuredContainer.innerHTML = errorHtml;
    }
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
