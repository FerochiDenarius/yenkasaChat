const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalPrevBtn = document.getElementById("modalPrevBtn");
const modalNextBtn = document.getElementById("modalNextBtn");
const modalImageCounter = document.getElementById("modalImageCounter");
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
let modalImages = [];
let modalImageIndex = 0;
const productDisplayLabels = {
  bale: "Bale",
  dress: "Dress",
  fabric: "Fabric",
  accessory: "Accessory",
  car_importation: "Cars Importation"
};

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

function getProductCategory(item) {
  const type = String(item.type || "").toLowerCase();
  const category = String(item.category || "").toLowerCase();
  const categoryType = String(item.categoryType || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  const combined = `${type} ${categoryType} ${category} ${name}`;

  if (
    type === "car_importation" ||
    categoryType === "car_importation" ||
    combined.includes("car") ||
    combined.includes("vehicle") ||
    combined.includes("import")
  ) {
    return "car_importation";
  }

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

function getProductImages(item) {
  const images = Array.isArray(item.imageUrls)
    ? item.imageUrls.filter(Boolean)
    : [];

  if (item.imageUrl && !images.includes(item.imageUrl)) {
    images.unshift(item.imageUrl);
  }

  return images;
}

function createProductCard(item) {
  const card = document.createElement("div");
  card.className = "card marketplace-product-card";
  const productCategory = getProductCategory(item);
  const categoryLabel = productDisplayLabels[productCategory] || "Product";
  const status = String(item.status || "available").toLowerCase();
  const productImages = getProductImages(item);
  const firstImage = productImages[0];
  const visibleGridImages = productImages.slice(1, 4);

  card.innerHTML = `
    ${firstImage ? `
      <div class="product-gallery ${productImages.length > 1 ? "multi-photo-gallery" : ""}">
        ${productImages.length > 1 ? `
          <div class="product-image-grid">
            <div
              class="product-grid-photo product-grid-photo-main"
              data-product-image="${firstImage}"
            >
              <img
                src="${firstImage}"
                alt="${item.name || "Yenkasa Store product"}"
                data-gallery-main
              >
              <span class="product-image-count">${productImages.length} photos</span>
            </div>

            <div class="product-grid-photo-stack">
              ${visibleGridImages.map((imageUrl, index) => `
                <button
                  type="button"
                  class="product-grid-photo"
                  data-product-image="${imageUrl}"
                  data-grid-index="${index + 1}"
                  aria-label="Open product photo ${index + 2}"
                >
                  <img src="${imageUrl}" alt="">
                </button>
              `).join("")}
            </div>
          </div>
        ` : `
        <div class="product-image-wrap single-product-image">
          ${productImages.length > 1 ? `<span class="product-image-count">${productImages.length} photos</span>` : ""}
          <img
            src="${firstImage}"
            alt="${item.name || "Yenkasa Store product"}"
            class="product-image"
            data-gallery-main
          >
        </div>
        `}
      </div>
    ` : `
      <div class="product-image-wrap product-image-placeholder">
        <span>${categoryLabel}</span>
      </div>
    `}

    <div class="card-content">
      <div class="card-top">
        <h3>${item.name || "Untitled Product"}</h3>
        <span class="status ${status}">${status}</span>
      </div>

      <p>${item.description || "No description available."}</p>

      <div class="product-meta-line">
        <span class="product-chip">${categoryLabel}</span>
        <span class="product-chip">${item.weight || item.size || "Details pending"}</span>
        <span class="product-chip">${item.category || "General"}</span>
        <span class="product-chip fixed-price-chip">Fixed Price</span>
      </div>

      <div class="price">GHS ${item.price || 0}</div>

      ${item.videoUrl
        ? `<video controls src="${item.videoUrl}"></video>`
        : ""}

      ${status !== "sold"
        ? `
          <div class="card-actions">
            <button class="add-cart-btn">Add to Cart</button>
          </div>
        `
        : `
          <button disabled>Sold Out</button>
        `}
    </div>
  `;

  const productImage = card.querySelector("[data-gallery-main]");
  const addCartBtn = card.querySelector(".add-cart-btn");
  const galleryButtons = card.querySelectorAll("[data-product-image]");

  if (productImage) {
    productImage.addEventListener("click", () => {
      openImage(productImage.src, productImages);
    });
  }

  card.querySelector(".product-grid-photo-main")?.addEventListener("click", () => {
    if (productImage) {
      openImage(productImage.src, productImages);
    }
  });

  galleryButtons.forEach(button => {
    button.addEventListener("click", () => {
      const nextImage = button.dataset.productImage;

      if (!nextImage) {
        return;
      }

      openImage(nextImage, productImages);
    });
  });

  if (!item.imageUrl && firstImage) {
    item.imageUrl = firstImage;
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

function renderMarketplaceProducts(products, options = {}) {
  const baleContainer = document.getElementById("bale-container");
  const dressContainer = document.getElementById("dress-container");
  const fabricContainer = document.getElementById("fabric-container");
  const accessoryContainer = document.getElementById("accessory-container");
  const importContainer = document.getElementById("import-container");
  const availableProducts = products.filter(item => String(item.status || "").toLowerCase() !== "sold");
  const featuredProducts = options.featuredProducts || availableProducts.slice(0, 6);
  const categoryGroups = {
    bale: products.filter(item => getProductCategory(item) === "bale"),
    dress: products.filter(item => getProductCategory(item) === "dress"),
    fabric: products.filter(item => getProductCategory(item) === "fabric"),
    accessory: products.filter(item => getProductCategory(item) === "accessory"),
    car_importation: products.filter(item => getProductCategory(item) === "car_importation")
  };

  renderIntoContainer(
    featuredContainer,
    featuredProducts,
    options.featuredEmptyTitle || "No featured products yet",
    options.featuredEmptyMessage || "Active products will appear here as sellers upload more items."
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

  renderIntoContainer(
    importContainer,
    categoryGroups.car_importation,
    "Cars importation listings coming soon",
    "Future car importation listings will appear in this premium section."
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSearchHaystack(item) {
  return normalizeSearchText([
    item.name,
    item.description,
    item.category,
    item.categoryType,
    item.status,
    item.weight,
    item.size,
    item.type,
    item.brand,
    item.color,
    item.material,
    item.condition,
    item.length,
    item.model,
    item.year,
    item.metadataJson
  ].join(" "));
}

function productMatchesQuery(item, query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  if (!terms.length) {
    return true;
  }

  const haystack = getSearchHaystack(item);
  return terms.every(term => haystack.includes(term));
}

function applySearch(options = {}) {
  const rawQuery = String(siteSearch?.value || "").trim();

  if (!rawQuery) {
    renderMarketplaceProducts(allProducts);
    return;
  }

  const filtered = allProducts.filter(item => productMatchesQuery(item, rawQuery));

  renderMarketplaceProducts(filtered, {
    featuredProducts: filtered,
    featuredEmptyTitle: `No results for "${rawQuery}"`,
    featuredEmptyMessage: "Try searching by product name, category, fabric, dress, bale, shoe, bag, colour or other details."
  });

  if (options.scrollToResults) {
    document.getElementById("featured")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

searchBtn?.addEventListener("click", () => applySearch({ scrollToResults: true }));
siteSearch?.addEventListener("input", applySearch);
siteSearch?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    applySearch({ scrollToResults: true });
  }
});

fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales")
  .then(res => res.json())
  .then(data => {
    allProducts = Array.isArray(data) ? data : [];
    applySearch();
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
    document.getElementById("import-container").innerHTML = errorHtml;
    if (featuredContainer) {
      featuredContainer.innerHTML = errorHtml;
    }
  });

imageModal.addEventListener("click", event => {
  if (event.target === imageModal) {
    closeImage();
  }
});

modalCloseBtn?.addEventListener("click", closeImage);
modalPrevBtn?.addEventListener("click", () => moveModalImage(-1));
modalNextBtn?.addEventListener("click", () => moveModalImage(1));

document.addEventListener("keydown", event => {
  if (imageModal.style.display !== "flex") {
    return;
  }

  if (event.key === "Escape") {
    closeImage();
  }
  if (event.key === "ArrowLeft") {
    moveModalImage(-1);
  }
  if (event.key === "ArrowRight") {
    moveModalImage(1);
  }
});

function openImage(src, images = []) {
  modalImages = Array.isArray(images) && images.length ? images : [src];
  modalImageIndex = Math.max(0, modalImages.indexOf(src));
  renderModalImage();
  imageModal.style.display = "flex";
}

function renderModalImage() {
  modalImage.src = modalImages[modalImageIndex] || "";

  const hasMultipleImages = modalImages.length > 1;
  modalPrevBtn.style.display = hasMultipleImages ? "grid" : "none";
  modalNextBtn.style.display = hasMultipleImages ? "grid" : "none";
  modalImageCounter.style.display = hasMultipleImages ? "block" : "none";
  modalImageCounter.textContent = hasMultipleImages
    ? `${modalImageIndex + 1} / ${modalImages.length}`
    : "";
}

function moveModalImage(direction) {
  if (modalImages.length <= 1) {
    return;
  }

  modalImageIndex = (modalImageIndex + direction + modalImages.length) % modalImages.length;
  renderModalImage();
}

function closeImage() {
  imageModal.style.display = "none";
  modalImages = [];
  modalImageIndex = 0;
}
