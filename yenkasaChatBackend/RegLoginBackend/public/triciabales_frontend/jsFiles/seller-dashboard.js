let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const imageInput = document.getElementById("imageFile");
const videoInput = document.getElementById("videoFile");
const imagePreview = document.getElementById("imagePreview");
const videoPreview = document.getElementById("videoPreview");
const addBaleBtn = document.getElementById("addBaleBtn");
const progressWrap = document.getElementById("progressWrap");
const statusText = document.getElementById("statusText");
const baleTab = document.getElementById("baleTab");
const singleTab = document.getElementById("singleTab");
const manageTab = document.getElementById("manageTab");
const ordersTab = document.getElementById("ordersTab");
const payoutTab = document.getElementById("payoutTab");
const profileTab = document.getElementById("profileTab");
const productType = document.getElementById("productType");
const productCategoryType = document.getElementById("productCategoryType");
const weightField = document.getElementById("weightField");
const catalogueFieldPanels = document.querySelectorAll(".catalogue-field-panel");
const uploadCard = document.getElementById("uploadCard");
const manageSection = document.getElementById("manageSection");
const ordersSection = document.getElementById("ordersSection");
const payoutSection = document.getElementById("payoutSection");
const profileSection = document.getElementById("profileSection");
const manageList = document.getElementById("manageList");
const sellerOrdersList = document.getElementById("sellerOrdersList");
const paidCount = document.getElementById("paid-count");
const pendingCount = document.getElementById("pending-count");
const completedCount = document.getElementById("completed-count");
const menuToggle = document.getElementById("menuToggle");
const dashboardMenu = document.getElementById("dashboardMenu");
const dashboardMenuCloseBtn = document.getElementById("dashboardMenuCloseBtn");
const payoutForm = document.getElementById("payout-form");
const payoutMethod = document.getElementById("payoutMethod");
const momoFields = document.getElementById("momoFields");
const bankFields = document.getElementById("bankFields");
const payoutCards = document.querySelectorAll(".payout-card");
const previewMethod = document.getElementById("preview-method");
const previewAccount = document.getElementById("preview-account");
const panelTitle = document.getElementById("panelTitle");
const panelDescription = document.getElementById("panelDescription");
const editModal = document.getElementById("editModal");
const closeEditModal = document.getElementById("closeEditModal");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editProductForm = document.getElementById("editProductForm");
const editCurrentImages = document.getElementById("editCurrentImages");
const editImageInput = document.getElementById("editImageFile");
const editImagePreview = document.getElementById("editImagePreview");
const API_BASE = "/triciabales-api";
const productCache = new Map();
let editRetainedImageUrls = [];
let editMediaDirty = false;

const productCatalogueLabels = {
  bale: "Bale",
  dress: "Dress / Clothing",
  shoe: "Shoes",
  bag: "Bags",
  wig: "Wig / Human Hair",
  fabric: "Fabric / Cloth",
  accessory: "Fashion Accessory",
  car_importation: "Cars Importation"
};

const productCataloguePanels = {
  dress: document.getElementById("dressFields"),
  shoe: document.getElementById("shoeFields"),
  bag: document.getElementById("bagFields"),
  wig: document.getElementById("wigFields"),
  fabric: document.getElementById("fabricFields"),
  accessory: document.getElementById("accessoryFields"),
  car_importation: document.getElementById("carFields")
};

if (!currentUser || !authToken) {
  window.location.href = "/store/buyer-login";
}

if (currentUser?.role === "SUPER_ADMIN") {
  window.location.href = "/store/super-admin";
}

if (currentUser?.role === "ADMIN") {
  window.location.href = "/store/admin";
}

if (currentUser?.role !== "SELLER") {
  window.location.href = "/store/buyer-login";
}

document.getElementById("sellerHeading").textContent = `${currentUser.name || "Seller"} Dashboard`;
document.getElementById("sellerSubheading").textContent = currentUser.email || "Manage your store from one place.";

window.updateCurrentUserFromProfile = function updateCurrentUserFromProfile(user) {
  if (!user) return;
  currentUser = user;
  document.getElementById("sellerHeading").textContent = `${currentUser.name || "Seller"} Dashboard`;
  document.getElementById("sellerSubheading").textContent = currentUser.email || "Manage your store from one place.";
};

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${authToken}`
  };
}

function getJsonAuthHeaders() {
  return {
    ...getAuthHeaders(),
    "Content-Type": "application/json"
  };
}

function closeMenu() {
  dashboardMenu.classList.remove("open");
}

function activateTab(activeTab) {
  [baleTab, singleTab, manageTab, ordersTab, payoutTab, profileTab].forEach(tab => {
    tab.classList.toggle("active", tab === activeTab);
  });
}

function showSection(section) {
  uploadCard.style.display = section === "upload" ? "block" : "none";
  manageSection.style.display = section === "manage" ? "block" : "none";
  ordersSection.style.display = section === "orders" ? "block" : "none";
  payoutSection.style.display = section === "payout" ? "block" : "none";
  profileSection.style.display = section === "profile" ? "block" : "none";
}

function getValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setFieldValue(id, value = "") {
  const field = document.getElementById(id);
  if (field) {
    field.value = value;
  }
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map(input => input.value);
}

function resetCatalogueFields() {
  catalogueFieldPanels.forEach(panel => {
    panel.querySelectorAll("input, select, textarea").forEach(field => {
      if (field.type === "checkbox" || field.type === "radio") {
        field.checked = false;
      } else {
        field.value = "";
      }
    });
  });
}

function updateCatalogueFieldVisibility(mode) {
  catalogueFieldPanels.forEach(panel => {
    panel.classList.add("hidden-panel");
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
  });

  const activePanel = productCataloguePanels[mode];
  if (activePanel) {
    activePanel.classList.remove("hidden-panel");
    activePanel.hidden = false;
    activePanel.setAttribute("aria-hidden", "false");
  }
}

function getProductNamePlaceholder(mode) {
  const placeholders = {
    bale: "e.g. Ladies Flannel Blouse Bale",
    dress: "e.g. Floral Summer Dress",
    shoe: "e.g. Black Nike Sneakers",
    bag: "e.g. Brown Leather Hand Bag",
    wig: "e.g. 24 inches Body Wave Human Hair",
    fabric: "e.g. 6 yards Ankara Fabric",
    accessory: "e.g. Gold Fashion Watch",
    car_importation: "e.g. Toyota Corolla Import"
  };

  return placeholders[mode] || "Enter product name";
}

function getCategoryPlaceholder(mode) {
  const placeholders = {
    bale: "Flannel Blouse",
    dress: "Women Dress",
    shoe: "Sneakers, Heels, Sandals",
    bag: "Hand Bag, Backpack",
    wig: "Human Hair, Wig, Bundle",
    fabric: "Lace, Kente, Ankara",
    accessory: "Watch, Jewelry, Belt",
    car_importation: "Sedan, SUV, Pickup"
  };

  return placeholders[mode] || "Product subcategory";
}

function getUploadActionLabel(mode) {
  return mode === "bale" ? "Product" : (productCatalogueLabels[mode] || "Product");
}

function setUploadMode(mode) {
  const nextMode = mode === "single" ? "dress" : (mode || "bale");
  productType.value = nextMode;
  productCategoryType.value = nextMode;

  const isBale = nextMode === "bale";
  const isDress = nextMode === "dress";
  const label = productCatalogueLabels[nextMode] || "Product";
  const uploadLabel = getUploadActionLabel(nextMode);

  weightField.style.display = isBale ? "flex" : "none";
  resetCatalogueFields();
  updateCatalogueFieldVisibility(nextMode);

  panelTitle.textContent = `Upload ${uploadLabel}`;
  panelDescription.textContent = "Choose the product type first, then complete the fields buyers need for that catalogue.";
  document.querySelector("label[for='name']").textContent = `${uploadLabel} Name`;
  document.getElementById("name").placeholder = getProductNamePlaceholder(nextMode);
  document.getElementById("category").placeholder = getCategoryPlaceholder(nextMode);
  addBaleBtn.textContent = `Upload ${uploadLabel}`;
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function estimateSellerPayout(order) {
  const sellerItems = Array.isArray(order.items)
    ? order.items.filter(item => Number(item.sellerId) === Number(currentUser.id))
    : [];

  if (sellerItems.length) {
    return sellerItems.reduce((sum, item) => {
      if (item.sellerPayoutAmount != null) {
        return sum + Number(item.sellerPayoutAmount || 0);
      }
      const lineTotal = item.lineTotal != null
        ? Number(item.lineTotal || 0)
        : Number(item.price || 0) * Number(item.quantity || 1);
      return sum + (lineTotal - (lineTotal * 0.10));
    }, 0);
  }

  if (order.sellerPayoutAmount != null) {
    return Number(order.sellerPayoutAmount || 0);
  }

  const total = Number(order.total || 0);
  return total - (total * 0.10);
}

function togglePayoutFields(method) {
  payoutCards.forEach(card => {
    card.classList.toggle("active", card.dataset.method === method);
  });

  payoutMethod.value = method || "";
  momoFields.classList.toggle("hidden-panel", method !== "momo");
  bankFields.classList.toggle("hidden-panel", method !== "bank");
  updatePayoutPreview();
}

function updatePayoutPreview() {
  const method = payoutMethod.value;

  if (method === "momo") {
    const network = document.getElementById("momoNetwork").value || "Mobile Money";
    const number = document.getElementById("momoNumber").value.trim();
    previewMethod.textContent = `Method: ${network}`;
    previewAccount.textContent = number
      ? `Account: ${number}`
      : "Enter your MoMo number to preview where payouts will go.";
    return;
  }

  if (method === "bank") {
    const bankName = document.getElementById("bankName").value.trim() || "Bank Transfer";
    const accountName = document.getElementById("bankAccountName").value.trim();
    const accountNumber = document.getElementById("bankAccountNumber").value.trim();
    previewMethod.textContent = `Method: ${bankName}`;
    previewAccount.textContent = accountName || accountNumber
      ? `Account: ${accountName || "Account Name"}${accountNumber ? ` • ${accountNumber}` : ""}`
      : "Enter your bank details to preview where payouts will go.";
    return;
  }

  previewMethod.textContent = "No payout method selected";
  previewAccount.textContent = "";
}

async function loadPaystackBanks() {
  const bankSelect = document.getElementById("bankCode");
  const bankNameInput = document.getElementById("bankName");
  if (!bankSelect) return;

  try {
    const response = await fetch(`${API_BASE}/api/paystack/banks`, {
      headers: getAuthHeaders()
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not load Paystack banks");
    }

    const banks = Array.isArray(payload.banks) ? payload.banks : [];
    bankSelect.innerHTML = '<option value="">Select bank</option>';

    banks
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .forEach(bank => {
        const option = document.createElement("option");
        option.value = bank.code || "";
        option.textContent = bank.code ? `${bank.name} (${bank.code})` : bank.name;
        option.dataset.name = bank.name || "";
        bankSelect.appendChild(option);
      });

    if (currentUser?.bankCode) {
      bankSelect.value = currentUser.bankCode;
    }
    if (bankSelect.value && !bankNameInput.value.trim()) {
      bankNameInput.value = bankSelect.selectedOptions[0]?.dataset.name || "";
    }
    updatePayoutPreview();
  } catch (err) {
    console.error(err);
    bankSelect.innerHTML = '<option value="">Unable to load banks</option>';
  }
}

function hydratePayoutForm() {
  payoutMethod.value = currentUser?.payoutMethod || "momo";
  document.getElementById("momoNetwork").value = currentUser?.momoNetwork || "";
  document.getElementById("momoNumber").value = currentUser?.momoNumber || "";
  document.getElementById("bankName").value = currentUser?.bankName || "";
  document.getElementById("bankCode").value = currentUser?.bankCode || "";
  document.getElementById("bankAccountNumber").value = currentUser?.bankAccountNumber || "";
  document.getElementById("bankAccountName").value = currentUser?.bankAccountName || "";
  togglePayoutFields(payoutMethod.value);
}

function resetUploadForm() {
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("weight").value = "";
  document.getElementById("category").value = "";
  document.getElementById("description").value = "";
  document.getElementById("status").value = "available";
  resetCatalogueFields();
  imageInput.value = "";
  videoInput.value = "";
  imagePreview.innerHTML = "";
  imagePreview.style.display = "none";
  videoPreview.style.display = "none";
  videoPreview.removeAttribute("src");

  [
    "shoeBrand", "shoeSize", "shoeColor", "shoeCondition",
    "hairType", "hairLength", "hairColor", "hairDensity",
    "bagType", "bagColor", "bagMaterial", "bagCondition",
    "fabricType", "fabricLength", "fabricColor", "fabricPattern",
    "accessoryType", "accessoryBrand", "accessoryColor", "accessoryCondition",
    "carBrand", "carModel", "carYear", "carTransmission", "carMileage", "carFuel"
  ].forEach(id => setFieldValue(id));
}

function isFashionVideoOnlyAllowed(mode, category, description, name) {
  const normalizedMode = (mode || "").toLowerCase();
  if (
    normalizedMode === "single" ||
    normalizedMode === "dress" ||
    normalizedMode === "bale" ||
    normalizedMode === "shoe" ||
    normalizedMode === "bag" ||
    normalizedMode === "wig" ||
    normalizedMode === "fabric" ||
    normalizedMode === "accessory"
  ) {
    return true;
  }

  const combined = `${mode} ${category} ${description} ${name}`.toLowerCase();
  const fashionKeywords = [
    "fashion", "bale", "single", "cloth", "clothes", "clothing", "apparel",
    "dress", "shirt", "top", "blouse", "gown", "skirt", "trouser", "trousers",
    "jeans", "hoodie", "jacket", "sneaker", "shoe", "bag", "handbag",
    "boutique", "wear", "outfit", "ladies", "women", "women's", "mens", "men",
    "kids", "ladies wear", "mens wear", "kids wear", "wig", "hair",
    "human hair", "fabric", "textile", "material", "accessory", "accessories"
  ];

  return fashionKeywords.some(keyword => combined.includes(keyword));
}

function collectCatalogueDetails(mode) {
  const detailsByMode = {
    bale: {
      weight: getValue("weight")
    },
    dress: {
      sizes: getCheckedValues("dressSizes"),
      size: getCheckedValues("dressSizes").join(", "),
      color: getValue("dressColor"),
      condition: getValue("dressCondition")
    },
    shoe: {
      brand: getValue("shoeBrand"),
      size: getValue("shoeSize"),
      color: getValue("shoeColor"),
      condition: getValue("shoeCondition")
    },
    wig: {
      type: getValue("hairType"),
      length: getValue("hairLength"),
      color: getValue("hairColor"),
      density: getValue("hairDensity")
    },
    bag: {
      type: getValue("bagType"),
      color: getValue("bagColor"),
      material: getValue("bagMaterial"),
      condition: getValue("bagCondition")
    },
    fabric: {
      type: getValue("fabricType"),
      length: getValue("fabricLength"),
      color: getValue("fabricColor"),
      pattern: getValue("fabricPattern")
    },
    accessory: {
      type: getValue("accessoryType"),
      brand: getValue("accessoryBrand"),
      color: getValue("accessoryColor"),
      condition: getValue("accessoryCondition")
    },
    car_importation: {
      brand: getValue("carBrand"),
      model: getValue("carModel"),
      year: getValue("carYear"),
      transmission: getValue("carTransmission"),
      mileage: getValue("carMileage"),
      fuelType: getValue("carFuel")
    }
  };

  return detailsByMode[mode] || {};
}

function getPrimaryDetail(mode, details) {
  if (mode === "bale") return details.weight || "";
  if (mode === "dress" || mode === "shoe") return details.size || "";
  if (mode === "wig" || mode === "fabric") return details.length || "";
  if (mode === "bag" || mode === "accessory") return details.type || "";
  if (mode === "car_importation") return [details.year, details.brand, details.model].filter(Boolean).join(" ");
  return "";
}

function validateCatalogueDetails(mode, details) {
  if (mode === "bale" && !details.weight) {
    return "Please enter the bale weight.";
  }

  if (mode === "dress" && (!Array.isArray(details.sizes) || !details.sizes.length)) {
    return "Please select at least one dress size.";
  }

  if (mode === "shoe" && !details.size) {
    return "Please select the shoe size.";
  }

  if (mode === "wig" && (!details.type || !details.length || !details.color)) {
    return "Please enter hair type, length and color.";
  }

  if (mode === "bag" && !details.type) {
    return "Please select the bag type.";
  }

  if (mode === "fabric" && (!details.type || !details.length)) {
    return "Please enter fabric type and length.";
  }

  if (mode === "accessory" && !details.type) {
    return "Please enter the accessory type.";
  }

  if (mode === "car_importation" && (!details.brand || !details.model || !details.year)) {
    return "Please enter car brand, model and year.";
  }

  return "";
}

function renderProductThumbnail(item) {
  if (item.imageUrl) {
    return `
      <img
        src="${item.imageUrl}"
        alt="${item.name || "Product"}"
        class="manage-thumb"
      >
    `;
  }

  if (item.videoUrl) {
    return `
      <video
        src="${item.videoUrl}"
        class="manage-thumb"
        muted
        playsinline
      ></video>
    `;
  }

  return `<div class="manage-thumb placeholder">No Media</div>`;
}

function renderManageProducts(products) {
  productCache.clear();

  if (!products.length) {
    manageList.innerHTML = `
      <div class="manage-item">
        <div class="manage-info">
          <strong>No products yet</strong>
          <small>Your uploaded products will appear here.</small>
        </div>
      </div>
    `;
    return;
  }

  manageList.innerHTML = products.map(item => {
    productCache.set(String(item.id), item);

    return `
      <div class="manage-item">
        <div class="manage-product-main">
          ${renderProductThumbnail(item)}
          <div class="manage-info">
            <strong>${item.name || "Untitled Product"}</strong>
            <small>
              ${productCatalogueLabels[item.categoryType] || productCatalogueLabels[item.type] || item.type || "Product"} • ${item.status || "available"}<br>
              GH₵${Number(item.price || 0).toFixed(2)} • ${item.category || "-"}<br>
              ${item.weight ? `${item.categoryType === "dress" ? "Sizes" : "Main detail"}: ${item.weight}` : ""}
              ${item.color ? `<br>Color: ${item.color}` : ""}
              ${item.brand ? `<br>Brand: ${item.brand}` : ""}
            </small>
          </div>
        </div>

        <div class="manage-actions">
          <button class="manage-btn edit" data-action="edit" data-id="${item.id}">
            Edit
          </button>
          <button class="manage-btn status" data-action="status" data-id="${item.id}">
            ${item.status === "sold" ? "Mark Available" : "Mark Sold"}
          </button>
          <button class="manage-btn delete" data-action="delete" data-id="${item.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function openEditProduct(product) {
  const currentImages = Array.isArray(product.imageUrls) && product.imageUrls.length
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  document.getElementById("editProductId").value = product.id || "";
  document.getElementById("editName").value = product.name || "";
  document.getElementById("editPrice").value = product.price || "";
  document.getElementById("editCategory").value = product.category || "";
  document.getElementById("editStatus").value = product.status || "available";
  document.getElementById("editWeight").value = product.weight || "";
  document.getElementById("editDescription").value = product.description || "";
  editRetainedImageUrls = [...currentImages];
  editMediaDirty = false;
  editImageInput.value = "";
  editImagePreview.innerHTML = "";
  renderEditableImages();
  editModal.classList.add("show");
}

function closeProductModal() {
  editModal.classList.remove("show");
}

function renderEditableImages() {
  if (!editRetainedImageUrls.length) {
    editCurrentImages.innerHTML = `
      <div class="edit-image-empty">
        No current pictures. Add replacement pictures below.
      </div>
    `;
    return;
  }

  editCurrentImages.innerHTML = editRetainedImageUrls.map((url, index) => `
    <div class="edit-image-item">
      <img src="${url}" alt="Product picture ${index + 1}">
      <button type="button" class="edit-image-remove" data-index="${index}">
        Remove
      </button>
    </div>
  `).join("");
}

function renderEditImagePreview() {
  const files = Array.from(editImageInput.files || []);

  if (!files.length) {
    editImagePreview.innerHTML = "";
    return;
  }

  editImagePreview.innerHTML = files.map(file => `
    <img src="${URL.createObjectURL(file)}" alt="${file.name}">
  `).join("");
}

async function updateProductMedia(productId) {
  const formData = new FormData();

  editRetainedImageUrls.forEach(url => {
    formData.append("retainedImageUrls", url);
  });

  Array.from(editImageInput.files || []).forEach(file => {
    formData.append("image", file);
  });

  const response = await fetch(
    `${API_BASE}/api/triciabales/${productId}/media`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to update product pictures");
  }

  return data;
}

async function loadManageProducts() {
  manageList.innerHTML = "<p>Loading products...</p>";

  try {
    const response = await fetch(
      `${API_BASE}/api/triciabales/seller/${currentUser.id}`,
      {
        headers: getAuthHeaders()
      }
    );
    const products = await response.json();

    if (!response.ok) {
      throw new Error("Could not load products");
    }

    if (!products.length) {
      renderManageProducts([]);
      return;
    }

    renderManageProducts(products);
  } catch (err) {
    console.error(err);
    manageList.innerHTML = "<p>Unable to load your products.</p>";
  }
}

async function loadSellerOrders() {
  sellerOrdersList.innerHTML = "<p>Loading orders...</p>";

  try {
    const response = await fetch(
      `${API_BASE}/api/orders/seller/${currentUser.id}`,
      {
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load orders");
    }

    const orders = await response.json();
    const paidOrders = orders.filter(order => order.paymentStatus === "paid");
    const awaitingOrders = orders.filter(order =>
      order.paymentStatus === "awaiting_payment" || order.paymentStatus === "ready_for_payout"
    );
    const completedOrders = orders.filter(order => order.deliveryStatus === "delivered");

    paidCount.textContent = paidOrders.length;
    pendingCount.textContent = awaitingOrders.length;
    completedCount.textContent = completedOrders.length;

    if (!orders.length) {
      sellerOrdersList.innerHTML = "<p>No orders found.</p>";
      return;
    }

    sellerOrdersList.innerHTML = orders.map(order => {
      const total = Number(order.total || 0);
      const sellerReceives = estimateSellerPayout(order);
      const deliveryStatus = order.deliveryStatus || "pending";
      const paymentStatus = order.paymentStatus || "pending";
      const sellerItems = Array.isArray(order.items)
        ? order.items.filter(item => Number(item.sellerId) === Number(currentUser.id))
        : [];
      const itemSummary = sellerItems.length
        ? sellerItems.map(item => `${item.baleName || "Product"}${item.selectedSize ? ` (${item.selectedSize})` : ""} x ${item.quantity || 1}`).join(", ")
        : "";
      const acceptedBtn = deliveryStatus !== "accepted" && deliveryStatus !== "delivered"
        ? `
          <button class="manage-btn status seller-order-btn" data-id="${order.id}" data-action="accept">
            Mark Accepted
          </button>
        `
        : "";
      const deliveredBtn = deliveryStatus !== "delivered"
        ? `
          <button class="manage-btn status seller-order-btn" data-id="${order.id}" data-action="deliver">
            Mark Delivered
          </button>
        `
        : "";

      return `
        <div class="manage-item" style="align-items:flex-start; flex-direction:column;">
          <div style="width:100%;">
            <strong>Order #${order.id}</strong>
            <p><strong>Customer:</strong> ${order.customerName || "Unknown"}</p>
            <p><strong>Phone:</strong> ${order.phone || "-"}</p>
            <p><strong>Address:</strong> ${order.address || "-"}</p>
            <p><strong>Payment:</strong> ${order.paymentMethod || "-"} (${paymentStatus})</p>
            <p><strong>Delivery:</strong> ${deliveryStatus}</p>
            ${itemSummary ? `<p><strong>Items:</strong> ${itemSummary}</p>` : ""}
            <p><strong>Total:</strong> GH₵${total.toFixed(2)}</p>
            <p><strong>Estimated Seller Receives:</strong> GH₵${sellerReceives.toFixed(2)}</p>
          </div>

          <div class="manage-actions" style="margin-top:12px;">
            ${acceptedBtn}
            ${deliveredBtn}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    sellerOrdersList.innerHTML = "<p>Unable to load seller orders.</p>";
  }
}

async function markSold(id) {
  try {
    const response = await fetch(
      `${API_BASE}/api/triciabales/${id}/status`,
      {
        method: "PUT",
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update product status");
    }

    loadManageProducts();
  } catch (err) {
    console.error(err);
    alert("Unable to update product status.");
  }
}

async function deleteProduct(id) {
  const confirmDelete = confirm("Are you sure you want to delete this product?");
  if (!confirmDelete) return;

  try {
    const response = await fetch(
      `${API_BASE}/api/triciabales/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete product");
    }

    loadManageProducts();
  } catch (err) {
    console.error(err);
    alert("Unable to delete product.");
  }
}

menuToggle.addEventListener("click", () => {
  dashboardMenu.classList.toggle("open");
});

dashboardMenuCloseBtn?.addEventListener("click", closeMenu);

baleTab.addEventListener("click", () => {
  activateTab(baleTab);
  showSection("upload");
  setUploadMode("bale");
  closeMenu();
});

singleTab.addEventListener("click", () => {
  activateTab(singleTab);
  showSection("upload");
  setUploadMode("dress");
  closeMenu();
});

productCategoryType.addEventListener("change", () => {
  setUploadMode(productCategoryType.value);
});

manageTab.addEventListener("click", () => {
  activateTab(manageTab);
  showSection("manage");
  loadManageProducts();
  closeMenu();
});

ordersTab.addEventListener("click", () => {
  activateTab(ordersTab);
  showSection("orders");
  loadSellerOrders();
  closeMenu();
});

payoutTab.addEventListener("click", () => {
  activateTab(payoutTab);
  showSection("payout");
  closeMenu();
});

profileTab.addEventListener("click", () => {
  activateTab(profileTab);
  showSection("profile");
  closeMenu();
});

manageList.addEventListener("click", event => {
  const button = event.target.closest(".manage-btn");
  if (!button) return;
  const { action, id } = button.dataset;
  if (!id) return;

  if (action === "edit") {
    const product = productCache.get(String(id));
    if (product) {
      openEditProduct(product);
    }
  }

  if (action === "status") {
    markSold(Number(id));
  }

  if (action === "delete") {
    deleteProduct(Number(id));
  }
});

closeEditModal.addEventListener("click", closeProductModal);
cancelEditBtn.addEventListener("click", closeProductModal);

editModal.addEventListener("click", event => {
  if (event.target === editModal) {
    closeProductModal();
  }
});

editCurrentImages.addEventListener("click", event => {
  const button = event.target.closest(".edit-image-remove");
  if (!button) return;

  const imageIndex = Number(button.dataset.index);
  editRetainedImageUrls = editRetainedImageUrls.filter((_, index) => index !== imageIndex);
  editMediaDirty = true;
  renderEditableImages();
});

editImageInput.addEventListener("change", () => {
  editMediaDirty = true;
  renderEditImagePreview();
});

editProductForm.addEventListener("submit", async event => {
  event.preventDefault();

  const productId = document.getElementById("editProductId").value;
  if (!productId) return;

  const payload = {
    name: document.getElementById("editName").value.trim(),
    price: document.getElementById("editPrice").value,
    category: document.getElementById("editCategory").value.trim(),
    status: document.getElementById("editStatus").value,
    weight: document.getElementById("editWeight").value.trim(),
    description: document.getElementById("editDescription").value.trim()
  };

  if (!payload.name || !payload.price || !payload.category) {
    alert("Please enter product name, price and category.");
    return;
  }

  try {
    const submitButton = editProductForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    const response = await fetch(
      `${API_BASE}/api/triciabales/${productId}`,
      {
        method: "PUT",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Failed to update product");
    }

    if (editMediaDirty || editImageInput.files.length) {
      await updateProductMedia(productId);
    }

    alert("Product updated successfully.");
    closeProductModal();
    loadManageProducts();
  } catch (err) {
    console.error(err);
    alert(err.message || "Unable to update product.");
  } finally {
    const submitButton = editProductForm.querySelector('button[type="submit"]');
    submitButton.disabled = false;
    submitButton.textContent = "Save Changes";
  }
});

sellerOrdersList.addEventListener("click", async event => {
  const button = event.target.closest(".seller-order-btn");
  if (!button) return;

  const orderId = button.dataset.id;
  const action = button.dataset.action;
  if (!orderId || !action) return;

  try {
    const body = action === "accept"
      ? { deliveryStatus: "accepted" }
      : { deliveryStatus: "delivered" };

    const response = await fetch(
      `${API_BASE}/api/orders/${orderId}/status`,
      {
        method: "PUT",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update order");
    }

    alert(action === "accept" ? "Order marked as accepted." : "Order marked as delivered.");
    loadSellerOrders();
  } catch (err) {
    console.error(err);
    alert("Unable to update order status.");
  }
});

imageInput.addEventListener("change", () => {
  imagePreview.innerHTML = "";

  if (!imageInput.files.length) {
    imagePreview.style.display = "none";
    return;
  }

  imagePreview.style.display = "grid";
  Array.from(imageInput.files).forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    imagePreview.appendChild(img);
  });
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];

  if (!file) {
    videoPreview.style.display = "none";
    videoPreview.removeAttribute("src");
    return;
  }

  videoPreview.src = URL.createObjectURL(file);
  videoPreview.style.display = "block";
});

addBaleBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value.trim();
  const selectedProductType = productCategoryType.value || productType.value || "bale";
  const catalogueDetails = collectCatalogueDetails(selectedProductType);
  const primaryDetail = getPrimaryDetail(selectedProductType, catalogueDetails);
  const category = document.getElementById("category").value.trim();
  const description = document.getElementById("description").value.trim();
  const status = document.getElementById("status").value;
  const imageFiles = Array.from(imageInput.files);
  const videoFile = videoInput.files[0];
  const maxSize = 20 * 1024 * 1024;
  const productLabel = productCatalogueLabels[selectedProductType] || "Product";

  if (!name || !price || !category) {
    alert("Please fill all required fields.");
    return;
  }

  const catalogueError = validateCatalogueDetails(selectedProductType, catalogueDetails);
  if (catalogueError) {
    alert(catalogueError);
    return;
  }

  if (!imageFiles.length && !videoFile) {
    alert("Please select at least one image or one video.");
    return;
  }

  if (!imageFiles.length && videoFile && !isFashionVideoOnlyAllowed(selectedProductType, category, description, name)) {
    alert("Video-only listings must be fashion related.");
    return;
  }

  for (const imageFile of imageFiles) {
    if (imageFile.size > maxSize) {
      alert("One of the images is too large. Maximum size is 20MB.");
      return;
    }
  }

  if (videoFile && videoFile.size > maxSize) {
    alert("Video is too large. Maximum size is 20MB.");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("price", price);
  formData.append("weight", primaryDetail);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("status", status);
  formData.append("type", selectedProductType);
  formData.append("categoryType", selectedProductType);
  formData.append("metadataJson", JSON.stringify(catalogueDetails));
  formData.append("sellerId", currentUser.id);
  formData.append("sellerName", currentUser.name || "");

  if (catalogueDetails.brand) formData.append("brand", catalogueDetails.brand);
  if (catalogueDetails.color) formData.append("color", catalogueDetails.color);
  if (catalogueDetails.material) formData.append("material", catalogueDetails.material);
  if (catalogueDetails.condition) formData.append("condition", catalogueDetails.condition);
  if (catalogueDetails.length) formData.append("length", catalogueDetails.length);
  if (catalogueDetails.model) formData.append("model", catalogueDetails.model);
  if (catalogueDetails.year) formData.append("year", catalogueDetails.year);

  imageFiles.forEach(imageFile => formData.append("image", imageFile));
  if (videoFile) {
    formData.append("video", videoFile);
  }

  const uploadEndpoint = !imageFiles.length && videoFile
    ? `${API_BASE}/api/triciabales/upload/video-only`
    : `${API_BASE}/api/triciabales/upload`;

  addBaleBtn.disabled = true;
  addBaleBtn.textContent = `Uploading ${productLabel}...`;
  progressWrap.style.display = "block";
  statusText.style.display = "block";

  try {
    const response = await fetch(
      uploadEndpoint,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData
      }
    );

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText}`);
    }

    alert(`${productLabel} uploaded successfully.`);
    resetUploadForm();
    loadManageProducts();
  } catch (err) {
    console.error("Upload error:", err);
    alert(`Upload failed.\n\n${err.message}`);
  } finally {
    addBaleBtn.disabled = false;
    addBaleBtn.textContent = `Upload ${getUploadActionLabel(productType.value)}`;
    progressWrap.style.display = "none";
    statusText.style.display = "none";
  }
});

payoutCards.forEach(card => {
  card.addEventListener("click", () => {
    togglePayoutFields(card.dataset.method);
  });
});

["momoNetwork", "momoNumber", "bankName", "bankCode", "bankAccountNumber", "bankAccountName"].forEach(id => {
  document.getElementById(id).addEventListener("input", updatePayoutPreview);
  document.getElementById(id).addEventListener("change", updatePayoutPreview);
});

document.getElementById("bankCode").addEventListener("change", event => {
  const selected = event.target.selectedOptions[0];
  if (selected?.dataset.name) {
    document.getElementById("bankName").value = selected.dataset.name;
  }
  updatePayoutPreview();
});

payoutForm.addEventListener("submit", async event => {
  event.preventDefault();

  const method = payoutMethod.value;
  if (!method) {
    alert("Please choose a payout method.");
    return;
  }

  const payload = {
    userId: currentUser.id,
    payoutMethod: method,
    momoNetwork: document.getElementById("momoNetwork").value.trim() || null,
    momoNumber: document.getElementById("momoNumber").value.trim() || null,
    bankName: document.getElementById("bankName").value.trim() || null,
    bankCode: document.getElementById("bankCode").value.trim() || null,
    bankAccountNumber: document.getElementById("bankAccountNumber").value.trim() || null,
    bankAccountName: document.getElementById("bankAccountName").value.trim() || null
  };

  if (method === "momo" && (!payload.momoNetwork || !payload.momoNumber)) {
    alert("Please enter your MoMo network and number.");
    return;
  }

  if (method === "bank" && (!payload.bankName || !payload.bankCode || !payload.bankAccountNumber || !payload.bankAccountName)) {
    alert("Please complete all bank payout fields.");
    return;
  }

  const submitButton = payoutForm.querySelector('button[type="submit"]');

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    const response = await fetch(
      `${API_BASE}/api/seller/payout-details`,
      {
        method: "PUT",
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not save payout details");
    }

    localStorage.setItem("currentUser", JSON.stringify(data));
    alert("Payout details saved successfully.");
    window.location.href = "/store/seller-dashboard";
  } catch (err) {
    console.error(err);
    alert("Unable to save payout details.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Payout Details";
  }
});

hydratePayoutForm();
loadPaystackBanks();
setUploadMode("bale");
showSection("upload");
