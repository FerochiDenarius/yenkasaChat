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
const siteSearch = document.getElementById("siteSearch");
const searchBtn = document.getElementById("searchBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mainNav = document.getElementById("mainNav");
const mainNavCloseBtn = document.getElementById("mainNavCloseBtn");
const categorySpotlight = document.getElementById("categorySpotlight");
const sellerShowcase = document.getElementById("sellerShowcase");
const browseSection = document.getElementById("browse-products");
const categoryResults = document.getElementById("category-results");
const browseKicker = document.getElementById("browseKicker");
const browseTitle = document.getElementById("browseTitle");
const browseDescription = document.getElementById("browseDescription");
const browseCount = document.getElementById("browseCount");
const clearBrowseBtn = document.getElementById("clearBrowseBtn");
const heroProductCount = document.getElementById("heroProductCount");
const heroSellerCount = document.getElementById("heroSellerCount");
const heroCategoryCount = document.getElementById("heroCategoryCount");
const viewAllProductsBtn = document.getElementById("viewAllProductsBtn");
const supportEmailBtn = document.getElementById("supportEmailBtn");
const floatingSupportBtn = document.getElementById("floatingSupportBtn");
const menuLiveChatBtn = document.getElementById("menuLiveChatBtn");
const menuSupportCenterBtn = document.getElementById("menuSupportCenterBtn");
const navWelcomeTitle = document.getElementById("navWelcomeTitle");
const navWelcomeText = document.getElementById("navWelcomeText");
const liveChatLauncher = document.getElementById("liveChatLauncher");
const supportModal = document.getElementById("supportModal");
const supportForm = document.getElementById("supportForm");
const supportCloseBtn = document.getElementById("supportCloseBtn");
const supportCancelBtn = document.getElementById("supportCancelBtn");
const supportFeedback = document.getElementById("supportFeedback");
const supportSubmitBtn = document.getElementById("supportSubmitBtn");

const productDisplayLabels = {
  all: "All Products",
  bale: "Bales",
  dress: "Dresses",
  ladies_wear: "Fashion",
  fabric: "Fabrics",
  accessory: "Accessories",
  shoe: "Shoes",
  bag: "Bags",
  beauty: "Beauty",
  car_importation: "Cars"
};

const categoryConfig = {
  all: {
    title: "All Products",
    description: "Browse every active product from live Yenkasa sellers."
  },
  bale: {
    title: "Bales",
    description: "Bulk fashion bundles and bale arrivals from active sellers."
  },
  dress: {
    title: "Dresses",
    description: "Dresses and single-piece fashion items now available."
  },
  fabric: {
    title: "Fabrics",
    description: "Fabric, textile and material listings across the store."
  },
  accessory: {
    title: "Accessories",
    description: "Fashion accessories and finishing pieces from active sellers."
  },
  ladies_wear: {
    title: "Fashion",
    description: "Women and ladies fashion including tops, gowns, skirts and more."
  },
  shoe: {
    title: "Shoes",
    description: "Shoes, heels, sandals and footwear listings."
  },
  bag: {
    title: "Bags",
    description: "Bags, purses and handbags from the marketplace."
  },
  beauty: {
    title: "Beauty",
    description: "Beauty and personal care listings when sellers upload them."
  },
  car_importation: {
    title: "Cars Importation",
    description: "Vehicle and import listings when this category goes live."
  }
};

const orderedCategoryKeys = [
  "bale",
  "dress",
  "fabric",
  "accessory",
  "ladies_wear",
  "shoe",
  "bag",
  "beauty",
  "car_importation"
];

const supportContactEndpoint = "/triciabales-api/api/support/contact";
let allProducts = [];
let activeCategoryFilter = "";
let modalImages = [];
let modalImageIndex = 0;

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function getActiveProducts(products = allProducts) {
  return products.filter(item => String(item.status || "").toLowerCase() !== "sold");
}

function updateHomepageNav() {
  if (!logoutLink) {
    return;
  }

  if (currentUser) {
    if (navWelcomeTitle) {
      navWelcomeTitle.textContent = `Welcome back, ${currentUser.name || "shopper"}!`;
    }
    if (navWelcomeText) {
      navWelcomeText.textContent = currentUser.role
        ? `Signed in as ${String(currentUser.role).replace(/_/g, " ").toLowerCase()}.`
        : "Manage your orders, cart and store activity.";
    }
  } else {
    if (navWelcomeTitle) {
      navWelcomeTitle.textContent = "Welcome back!";
    }
    if (navWelcomeText) {
      navWelcomeText.textContent = "Manage your store and grow your business.";
    }
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
  } catch (error) {
    console.error(error);
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

function openMenu() {
  mainNav?.classList.add("open");
  mainNav?.setAttribute("aria-hidden", "false");
}

function closeMenu() {
  mainNav?.classList.remove("open");
  mainNav?.setAttribute("aria-hidden", "true");
}

logoutLink?.addEventListener("click", event => {
  event.preventDefault();
  logout();
});

mobileMenuBtn?.addEventListener("click", openMenu);
mainNavCloseBtn?.addEventListener("click", closeMenu);

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("click", event => {
  if (!event.target.closest(".store-nav-panel") && !event.target.closest("#mobileMenuBtn")) {
    closeMenu();
  }
});

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
    item.metadataJson,
    item.sellerName
  ].join(" "));
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
    combined.includes("jewelry") ||
    combined.includes("jewellery") ||
    combined.includes("watch") ||
    combined.includes("belt") ||
    combined.includes("cap") ||
    combined.includes("hat")
  ) {
    return "accessory";
  }

  if (
    combined.includes("ladies") ||
    combined.includes("women") ||
    combined.includes("female") ||
    combined.includes("skirt") ||
    combined.includes("blouse") ||
    combined.includes("jumpsuit")
  ) {
    return "ladies_wear";
  }

  return "bale";
}

function parseProductMetadata(item) {
  if (!item?.metadataJson) {
    return {};
  }

  try {
    return JSON.parse(item.metadataJson);
  } catch (error) {
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

function productMatchesQuery(item, query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  if (!terms.length) {
    return true;
  }

  const haystack = getSearchHaystack(item);
  return terms.every(term => haystack.includes(term));
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
  const productCategory = getProductCategory(item);
  const categoryLabel = productDisplayLabels[productCategory] || "Product";
  const status = String(item.status || "available").toLowerCase();
  const productImages = getProductImages(item);
  const firstImage = productImages[0];
  const visibleGridImages = productImages.slice(1, 4);
  const dressSizes = productCategory === "dress" ? getDressSizes(item) : [];
  const sellerName = item.sellerName || "Yenkasa Seller";

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
        <div>
          <h3>${item.name || "Untitled Product"}</h3>
          <span class="product-seller-name">${sellerName}</span>
        </div>
        <span class="status ${status}">${status}</span>
      </div>

      <p>${item.description || "No description available."}</p>

      <div class="product-meta-line">
        <span class="product-chip">${categoryLabel}</span>
        <span class="product-chip">${item.weight || item.size || "Details pending"}</span>
        <span class="product-chip">${item.category || "General"}</span>
      </div>

      <div class="price">GHS ${item.price || 0}</div>

      ${item.videoUrl ? `<video controls src="${item.videoUrl}"></video>` : ""}

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

function getCategoryPreviewImage(products, categoryKey) {
  const matching = products.find(item => productMatchesCategory(item, categoryKey));
  return getProductImages(matching || {})[0] || "";
}

function renderHeroStats(products) {
  const activeProducts = getActiveProducts(products);
  const sellerIds = new Set();
  const liveCategories = new Set();

  activeProducts.forEach(item => {
    if (item.sellerId != null) {
      sellerIds.add(String(item.sellerId));
    } else if (item.sellerName) {
      sellerIds.add(String(item.sellerName));
    }

    liveCategories.add(getProductCategory(item));
  });

  if (heroProductCount) {
    heroProductCount.textContent = String(activeProducts.length);
  }

  if (heroSellerCount) {
    heroSellerCount.textContent = String(sellerIds.size);
  }

  if (heroCategoryCount) {
    heroCategoryCount.textContent = String(liveCategories.size);
  }
}

function renderCategorySpotlight(products) {
  if (!categorySpotlight) {
    return;
  }

  const activeProducts = getActiveProducts(products);
  clearContainer(categorySpotlight);

  const cards = [
    ...orderedCategoryKeys.map(categoryKey => {
      const count = activeProducts.filter(item => productMatchesCategory(item, categoryKey)).length;
      const imageUrl = getCategoryPreviewImage(activeProducts, categoryKey);
      const config = categoryConfig[categoryKey];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-spotlight-card";
      button.dataset.categoryFilter = categoryKey;
      button.innerHTML = `
        <div class="category-card-thumb ${imageUrl ? "has-image" : ""}">
          ${imageUrl ? `<img src="${imageUrl}" alt="${config.title}">` : `<span>${productDisplayLabels[categoryKey]}</span>`}
        </div>
        <div class="category-card-copy">
          <strong>${productDisplayLabels[categoryKey]}</strong>
          <span>${count} item${count === 1 ? "" : "s"}</span>
        </div>
      `;
      return button;
    }),
    (() => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-spotlight-card category-view-all-card";
      button.dataset.categoryFilter = "all";
      button.innerHTML = `
        <div class="category-card-thumb category-view-all-thumb">
          <span>All</span>
        </div>
        <div class="category-card-copy">
          <strong>View All</strong>
          <span>${activeProducts.length} live products</span>
        </div>
      `;
      return button;
    })()
  ];

  cards.forEach(card => categorySpotlight.appendChild(card));
}

function getSellerGroups(products) {
  const map = new Map();

  getActiveProducts(products).forEach(item => {
    const key = item.sellerId != null ? String(item.sellerId) : String(item.sellerName || "unknown");
    const sellerName = item.sellerName || "Yenkasa Seller";

    if (!map.has(key)) {
      map.set(key, {
        key,
        sellerName,
        items: []
      });
    }

    map.get(key).items.push(item);
  });

  return Array.from(map.values())
    .map(group => ({
      ...group,
      items: group.items.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    }))
    .sort((a, b) => b.items.length - a.items.length || a.sellerName.localeCompare(b.sellerName));
}

function renderSellerShowcase(products) {
  if (!sellerShowcase) {
    return;
  }

  clearContainer(sellerShowcase);

  const groups = getSellerGroups(products);
  if (!groups.length) {
    sellerShowcase.innerHTML = getEmptyCategoryCard(
      "No live seller products yet",
      "Seller product previews will appear here as soon as listings are available."
    );
    return;
  }

  groups.forEach(group => {
    const previewItems = group.items.slice(0, 4);
    const section = document.createElement("article");
    section.className = "seller-showcase-card";

    const header = document.createElement("div");
    header.className = "seller-showcase-head";
    header.innerHTML = `
      <div>
        <span>Seller Preview</span>
        <h3>${group.sellerName}</h3>
        <p>${group.items.length} product${group.items.length === 1 ? "" : "s"} live now.</p>
      </div>
      <button type="button" class="seller-showcase-link" data-category-filter="all">View all products</button>
    `;

    const grid = document.createElement("div");
    grid.className = "seller-product-grid";
    previewItems.forEach(item => {
      grid.appendChild(createProductCard(item));
    });

    section.appendChild(header);
    section.appendChild(grid);

    if (group.items.length > previewItems.length) {
      const footer = document.createElement("div");
      footer.className = "seller-showcase-foot";
      footer.textContent = `Showing ${previewItems.length} of ${group.items.length} items from ${group.sellerName}.`;
      section.appendChild(footer);
    }

    sellerShowcase.appendChild(section);
  });
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

function applySearch(options = {}) {
  const rawQuery = String(siteSearch?.value || "").trim();
  const activeProducts = getActiveProducts(allProducts);

  if (!rawQuery && !activeCategoryFilter) {
    hideBrowseResults();
    return;
  }

  const filtered = activeProducts.filter(item => (
    productMatchesQuery(item, rawQuery) && productMatchesCategory(item, activeCategoryFilter)
  ));
  const categoryInfo = categoryConfig[activeCategoryFilter] || {};
  const title = rawQuery
    ? `Results for "${rawQuery}"`
    : categoryInfo.title || "Browse Products";

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

function applyCategoryFilter(categoryKey, options = {}) {
  activeCategoryFilter = categoryKey || "all";
  closeMenu();

  if (options.clearSearch && siteSearch) {
    siteSearch.value = "";
  }

  applySearch({ scrollToResults: options.scrollToResults !== false });
}

function renderStorefront(products) {
  renderHeroStats(products);
  renderCategorySpotlight(products);
  renderSellerShowcase(products);
}

searchBtn?.addEventListener("click", () => applySearch({ scrollToResults: true }));
siteSearch?.addEventListener("input", () => applySearch());
siteSearch?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    applySearch({ scrollToResults: true });
  }
});

viewAllProductsBtn?.addEventListener("click", () => {
  applyCategoryFilter("all", {
    clearSearch: true,
    scrollToResults: true
  });
});

clearBrowseBtn?.addEventListener("click", () => {
  if (siteSearch) {
    siteSearch.value = "";
  }

  activeCategoryFilter = "";
  hideBrowseResults();
  document.getElementById("shop-categories")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

document.addEventListener("click", event => {
  const jumpButton = event.target.closest(".category-jump-btn");
  if (jumpButton) {
    document.getElementById("shop-categories")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    return;
  }

  const categoryButton = event.target.closest("[data-category-filter]");
  if (categoryButton) {
    const categoryKey = categoryButton.dataset.categoryFilter || "all";
    applyCategoryFilter(categoryKey, {
      clearSearch: categoryKey === "all",
      scrollToResults: true
    });
    return;
  }
});

fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales")
  .then(response => response.json())
  .then(data => {
    allProducts = Array.isArray(data) ? data : [];
    updateHomepageNav();
    renderStorefront(allProducts);
    applySearch();
  })
  .catch(error => {
    console.error(error);

    const errorHtml = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;background:white;border-radius:20px;">
        <h3>Unable to load products</h3>
        <p>Please check that the server is running.</p>
      </div>
    `;

    if (categorySpotlight) {
      categorySpotlight.innerHTML = errorHtml;
    }

    if (sellerShowcase) {
      sellerShowcase.innerHTML = errorHtml;
    }

    if (categoryResults) {
      browseSection?.classList.remove("hidden");
      categoryResults.innerHTML = errorHtml;
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
  if (!supportModal) {
    return;
  }

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
  if (!supportModal) {
    return;
  }

  supportModal.classList.remove("show");
  supportModal.setAttribute("aria-hidden", "true");
}

function setSupportFeedback(message, type) {
  if (!supportFeedback) {
    return;
  }

  supportFeedback.textContent = message;
  supportFeedback.className = `support-feedback ${type || "hidden"}`;
}

async function submitSupportMessage(event) {
  event.preventDefault();
  if (!supportForm || !supportSubmitBtn) {
    return;
  }

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

    supportForm.reset();
    setSupportFeedback("Your message has been sent. We will get back to you shortly.", "success");

    setTimeout(() => {
      closeSupportForm();
      setSupportFeedback("", "");
    }, 1200);
  } catch (error) {
    console.error(error);
    setSupportFeedback(error.message || "Unable to send your message right now.", "error");
  } finally {
    supportSubmitBtn.disabled = false;
    supportSubmitBtn.textContent = "Send Message";
  }
}

imageModal?.addEventListener("click", event => {
  if (event.target === imageModal) {
    closeImage();
  }
});

modalCloseBtn?.addEventListener("click", closeImage);
modalPrevBtn?.addEventListener("click", () => moveModalImage(-1));
modalNextBtn?.addEventListener("click", () => moveModalImage(1));
supportEmailBtn?.addEventListener("click", openSupportForm);
floatingSupportBtn?.addEventListener("click", openSupportForm);
menuSupportCenterBtn?.addEventListener("click", openSupportForm);
menuLiveChatBtn?.addEventListener("click", () => {
  if (window.yenkasaLiveChat && typeof window.yenkasaLiveChat.open === "function") {
    window.yenkasaLiveChat.open();
    return;
  }

  openSupportForm();
});
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

  if (imageModal?.style.display !== "flex") {
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

updateHomepageNav();
