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
const categoryMenuBtn = document.getElementById("categoryMenuBtn");
const categoryMenuPanel = document.getElementById("categoryMenuPanel");
const mainNavCloseBtn = document.getElementById("mainNavCloseBtn");
const browseSection = document.getElementById("browse-products");
const categoryResults = document.getElementById("category-results");
const browseKicker = document.getElementById("browseKicker");
const browseTitle = document.getElementById("browseTitle");
const browseDescription = document.getElementById("browseDescription");
const browseCount = document.getElementById("browseCount");
const clearBrowseBtn = document.getElementById("clearBrowseBtn");
const supportEmailBtn = document.getElementById("supportEmailBtn");
const liveChatLauncher = document.getElementById("liveChatLauncher");
const supportModal = document.getElementById("supportModal");
const supportForm = document.getElementById("supportForm");
const supportCloseBtn = document.getElementById("supportCloseBtn");
const supportCancelBtn = document.getElementById("supportCancelBtn");
const supportFeedback = document.getElementById("supportFeedback");
const supportSubmitBtn = document.getElementById("supportSubmitBtn");
const promoSlides = document.querySelectorAll(".promo-slide");
let allProducts = [];
let currentPromoIndex = 0;
let modalImages = [];
let modalImageIndex = 0;
let activeCategoryFilter = "";
const productDisplayLabels = {
  bale: "Bale",
  dress: "Dress",
  ladies_wear: "Ladies Wear",
  fabric: "Fabric",
  accessory: "Accessory",
  shoe: "Shoes",
  bag: "Bags",
  beauty: "Beauty",
  car_importation: "Cars Importation"
};
const categoryConfig = {
  all: {
    title: "All Products",
    description: "Browse active products across all store categories."
  },
  dress: {
    title: "Dresses",
    description: "Dresses and single fashion pieces from active sellers."
  },
  ladies_wear: {
    title: "Ladies Wear",
    description: "Women and ladies fashion, including dresses, tops, gowns and related pieces."
  },
  bale: {
    title: "Bales",
    description: "Bulk fashion bundles and bale arrivals."
  },
  fabric: {
    title: "Fabrics",
    description: "Fabric, textile and material listings."
  },
  accessory: {
    title: "Accessories",
    description: "Fashion add-ons and accessories."
  },
  shoe: {
    title: "Shoes",
    description: "Shoes, heels, sandals and footwear listings."
  },
  bag: {
    title: "Bags",
    description: "Bags, purses and handbags."
  },
  beauty: {
    title: "Beauty",
    description: "Cosmetics, beauty and personal care items."
  },
  car_importation: {
    title: "Cars Importation",
    description: "Vehicle and import listings when available."
  }
};
const supportEmail = "support@store.yenkas.xyz";
const supportContactEndpoint = "/triciabales-api/api/support/contact";

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

mainNavCloseBtn?.addEventListener("click", () => {
  mainNav?.classList.remove("open");
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
  });
});

categoryMenuBtn?.addEventListener("click", event => {
  event.stopPropagation();
  categoryMenuPanel?.classList.toggle("open");
});

document.addEventListener("click", event => {
  if (!event.target.closest(".category-menu")) {
    categoryMenuPanel?.classList.remove("open");
  }
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

function addToCart(item, selectedSize = "") {
  const cart = getCart();
  const cartKey = selectedSize ? `${item.id}:${selectedSize}` : String(item.id);

  const existing = cart.find(cartItem => (cartItem.cartKey || String(cartItem.id)) === cartKey);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      cartKey,
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      selectedSize,
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
  const description = String(item.description || "").toLowerCase();
  const combined = `${type} ${categoryType} ${category} ${name} ${description}`;

  if (
    type === "car_importation" ||
    categoryType === "car_importation" ||
    combined.includes("car") ||
    combined.includes("vehicle") ||
    combined.includes("import")
  ) {
    return "car_importation";
  }

  if (combined.includes("shoe") || combined.includes("heel") || combined.includes("sandal") || combined.includes("footwear")) {
    return "shoe";
  }

  if (combined.includes("bag") || combined.includes("purse") || combined.includes("handbag")) {
    return "bag";
  }

  if (
    combined.includes("cosmetic") ||
    combined.includes("beauty") ||
    combined.includes("makeup") ||
    combined.includes("skin care") ||
    combined.includes("skincare")
  ) {
    return "beauty";
  }

  if (type === "single" || combined.includes("dress") || combined.includes("gown")) {
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

function parseProductMetadata(item) {
  if (!item?.metadataJson) {
    return {};
  }

  try {
    return JSON.parse(item.metadataJson);
  } catch (err) {
    return {};
  }
}

function getDressSizes(item) {
  const metadata = parseProductMetadata(item);
  if (Array.isArray(metadata.sizes)) {
    return metadata.sizes.filter(Boolean);
  }
  if (metadata.size) {
    return String(metadata.size).split(",").map(size => size.trim()).filter(Boolean);
  }
  if (item.weight && getProductCategory(item) === "dress") {
    return String(item.weight).split(",").map(size => size.trim()).filter(Boolean);
  }
  return [];
}

function productMatchesCategory(item, categoryKey) {
  if (!categoryKey || categoryKey === "all") {
    return true;
  }

  const productCategory = getProductCategory(item);
  const haystack = getSearchHaystack(item);

  if (categoryKey === productCategory) {
    return true;
  }

  if (categoryKey === "ladies_wear") {
    return [
      "ladies",
      "lady",
      "women",
      "woman",
      "female",
      "dress",
      "gown",
      "skirt",
      "blouse",
      "top",
      "jumpsuit",
      "leggings",
      "bra",
      "lingerie"
    ].some(term => haystack.includes(term));
  }

  if (categoryKey === "accessory") {
    return ["accessory", "jewelry", "jewellery", "watch", "belt", "cap", "hat"].some(term => haystack.includes(term));
  }

  return false;
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
  const dressSizes = productCategory === "dress" ? getDressSizes(item) : [];

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

      ${dressSizes.length ? `
        <label class="product-size-picker">
          <span>Choose size</span>
          <select data-dress-size>
            <option value="">Select size</option>
            ${dressSizes.map(size => `<option value="${size}">${size}</option>`).join("")}
          </select>
        </label>
      ` : ""}

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
  const dressSizeSelect = card.querySelector("[data-dress-size]");
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
      const selectedSize = dressSizeSelect?.value || "";
      if (dressSizeSelect && !selectedSize) {
        alert("Please select a dress size before adding to cart.");
        dressSizeSelect.focus();
        return;
      }
      addToCart(item, selectedSize);
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
  const availableProducts = products.filter(item => String(item.status || "").toLowerCase() !== "sold");
  const featuredProducts = options.featuredProducts || availableProducts.slice(0, 6);

  renderIntoContainer(
    featuredContainer,
    featuredProducts,
    options.featuredEmptyTitle || "No featured products yet",
    options.featuredEmptyMessage || "Active products will appear here as sellers upload more items."
  );
}

function showBrowseResults(products, options = {}) {
  if (!browseSection || !categoryResults) {
    return;
  }

  const config = categoryConfig[options.categoryKey] || {};
  browseSection.classList.remove("hidden");
  browseKicker.textContent = options.kicker || "Browse";
  browseTitle.textContent = options.title || config.title || "Shop Products";
  browseDescription.textContent = options.description || config.description || "Browse active products from sellers.";
  browseCount.textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;

  renderIntoContainer(
    categoryResults,
    products,
    options.emptyTitle || "No products found",
    options.emptyMessage || "Try another category or search term."
  );
}

function hideBrowseResults() {
  activeCategoryFilter = "";
  browseSection?.classList.add("hidden");
  clearContainer(categoryResults);
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

  if (!rawQuery && !activeCategoryFilter) {
    renderMarketplaceProducts(allProducts);
    hideBrowseResults();
    return;
  }

  const browseableProducts = allProducts.filter(item => String(item.status || "").toLowerCase() !== "sold");
  const filtered = browseableProducts.filter(item => (
    productMatchesQuery(item, rawQuery) && productMatchesCategory(item, activeCategoryFilter)
  ));
  const categoryInfo = categoryConfig[activeCategoryFilter] || {};
  const title = rawQuery
    ? `Results for "${rawQuery}"`
    : categoryInfo.title || "Browse Products";

  renderMarketplaceProducts(allProducts);
  showBrowseResults(filtered, {
    categoryKey: activeCategoryFilter,
    kicker: rawQuery ? "Search Results" : "Category",
    title,
    description: rawQuery
      ? "Matching products from active listings."
      : categoryInfo.description,
    emptyTitle: rawQuery ? `No results for "${rawQuery}"` : `No ${title.toLowerCase()} found`,
    emptyMessage: "Try another category, search by product name, or check back as sellers upload more items."
  });

  if (options.scrollToResults) {
    browseSection?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function applyCategoryFilter(categoryKey) {
  activeCategoryFilter = categoryKey || "all";
  categoryMenuPanel?.classList.remove("open");
  mainNav?.classList.remove("open");
  applySearch({ scrollToResults: true });
}

searchBtn?.addEventListener("click", () => applySearch({ scrollToResults: true }));
siteSearch?.addEventListener("input", applySearch);
siteSearch?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    applySearch({ scrollToResults: true });
  }
});
categoryMenuPanel?.addEventListener("click", event => {
  const button = event.target.closest("[data-category-filter]");
  if (!button) return;

  applyCategoryFilter(button.dataset.categoryFilter || "all");
});
clearBrowseBtn?.addEventListener("click", () => {
  if (siteSearch) {
    siteSearch.value = "";
  }

  activeCategoryFilter = "";
  applySearch({ scrollToResults: true });
  document.getElementById("featured")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
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

    if (featuredContainer) {
      featuredContainer.innerHTML = errorHtml;
    }
    if (categoryResults) {
      browseSection?.classList.remove("hidden");
      categoryResults.innerHTML = errorHtml;
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
supportEmailBtn?.addEventListener("click", openSupportForm);
liveChatLauncher?.addEventListener("click", () => {
  if (window.yenkasaLiveChat && typeof window.yenkasaLiveChat.open === "function") {
    window.yenkasaLiveChat.open();
    return;
  }

  openSupportForm();
});
supportCloseBtn?.addEventListener("click", closeSupportForm);
supportCancelBtn?.addEventListener("click", closeSupportForm);
supportModal?.addEventListener("click", event => {
  if (event.target === supportModal) {
    closeSupportForm();
  }
});
supportForm?.addEventListener("submit", submitSupportMessage);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && supportModal?.classList.contains("show")) {
    closeSupportForm();
    return;
  }

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

function openSupportForm() {
  if (!supportModal) return;

  supportModal.classList.add("show");
  supportModal.setAttribute("aria-hidden", "false");
  setSupportFeedback("", "");

  const nameField = document.getElementById("supportName");
  const emailField = document.getElementById("supportEmail");
  if (currentUser?.name && nameField && !nameField.value) {
    nameField.value = currentUser.name;
  }
  if (currentUser?.email && emailField && !emailField.value) {
    emailField.value = currentUser.email;
  }

  setTimeout(() => nameField?.focus(), 50);
}

function closeSupportForm() {
  if (!supportModal) return;

  supportModal.classList.remove("show");
  supportModal.setAttribute("aria-hidden", "true");
}

function setSupportFeedback(message, type) {
  if (!supportFeedback) return;

  supportFeedback.textContent = message;
  supportFeedback.className = `support-feedback ${type || "hidden"}`;
}

async function submitSupportMessage(event) {
  event.preventDefault();
  if (!supportForm || !supportSubmitBtn) return;

  const formData = new FormData(supportForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    website: String(formData.get("website") || "").trim(),
    pageUrl: window.location.href
  };

  if (payload.name.length < 2 || payload.message.length < 10 || !payload.email.includes("@")) {
    setSupportFeedback("Please enter your name, a valid email, and a clear message.", "error");
    return;
  }

  try {
    supportSubmitBtn.disabled = true;
    supportSubmitBtn.textContent = "Sending...";
    setSupportFeedback("Sending your message...", "info");

    const response = await fetch(supportContactEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || "Unable to send your message.");
    }

    setSupportFeedback(`Message sent. We will reply from ${supportEmail}.`, "success");
    supportForm.reset();

    setTimeout(closeSupportForm, 1600);
  } catch (err) {
    console.error(err);
    setSupportFeedback(err.message || "Unable to send your message right now.", "error");
  } finally {
    supportSubmitBtn.disabled = false;
    supportSubmitBtn.textContent = "Send Message";
  }
}
