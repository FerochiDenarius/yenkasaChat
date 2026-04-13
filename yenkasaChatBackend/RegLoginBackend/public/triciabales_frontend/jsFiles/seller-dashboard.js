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
const weightField = document.getElementById("weightField");
const sizeField = document.getElementById("sizeField");
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

function setUploadMode(mode) {
  productType.value = mode;
  const isBale = mode === "bale";

  weightField.style.display = isBale ? "flex" : "none";
  sizeField.style.display = isBale ? "none" : "flex";
  panelTitle.textContent = isBale ? "Upload New Bale" : "Upload Single Dress";
  panelDescription.textContent = isBale
    ? "Add a bale listing with images, or upload a fashion-related video only."
    : "Add one fashion item with size, images, or a fashion-related video only.";
  document.querySelector("label[for='name']").textContent = isBale ? "Bale Name" : "Dress Name";
  document.getElementById("name").placeholder = isBale
    ? "e.g. Ladies Flannel Blouse Bale"
    : "e.g. Floral Summer Dress";
  addBaleBtn.textContent = isBale ? "Upload Bale" : "Upload Dress";
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function estimateSellerPayout(order) {
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

function hydratePayoutForm() {
  payoutMethod.value = currentUser?.payoutMethod || "momo";
  document.getElementById("momoNetwork").value = currentUser?.momoNetwork || "";
  document.getElementById("momoNumber").value = currentUser?.momoNumber || "";
  document.getElementById("bankName").value = currentUser?.bankName || "";
  document.getElementById("bankAccountNumber").value = currentUser?.bankAccountNumber || "";
  document.getElementById("bankAccountName").value = currentUser?.bankAccountName || "";
  togglePayoutFields(payoutMethod.value);
}

function resetUploadForm() {
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("weight").value = "";
  document.getElementById("size").value = "";
  document.getElementById("category").value = "";
  document.getElementById("description").value = "";
  document.getElementById("status").value = "available";
  imageInput.value = "";
  videoInput.value = "";
  imagePreview.innerHTML = "";
  imagePreview.style.display = "none";
  videoPreview.style.display = "none";
  videoPreview.removeAttribute("src");
}

function isFashionVideoOnlyAllowed(mode, category, description, name) {
  const normalizedMode = (mode || "").toLowerCase();
  if (normalizedMode === "single" || normalizedMode === "dress" || normalizedMode === "bale") {
    return true;
  }

  const combined = `${mode} ${category} ${description} ${name}`.toLowerCase();
  const fashionKeywords = [
    "fashion", "bale", "single", "cloth", "clothes", "clothing", "apparel",
    "dress", "shirt", "top", "blouse", "gown", "skirt", "trouser", "trousers",
    "jeans", "hoodie", "jacket", "sneaker", "shoe", "bag", "handbag",
    "boutique", "wear", "outfit", "ladies", "women", "women's", "mens", "men",
    "kids", "ladies wear", "mens wear", "kids wear"
  ];

  return fashionKeywords.some(keyword => combined.includes(keyword));
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
              ${item.type || "product"} • ${item.status || "available"}<br>
              GH₵${Number(item.price || 0).toFixed(2)} • ${item.category || "-"}<br>
              ${item.weight ? `Weight/Size: ${item.weight}` : ""}
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

baleTab.addEventListener("click", () => {
  activateTab(baleTab);
  showSection("upload");
  setUploadMode("bale");
  closeMenu();
});

singleTab.addEventListener("click", () => {
  activateTab(singleTab);
  showSection("upload");
  setUploadMode("single");
  closeMenu();
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
  const weight = document.getElementById("weight").value.trim();
  const size = document.getElementById("size").value;
  const category = document.getElementById("category").value.trim();
  const description = document.getElementById("description").value.trim();
  const status = document.getElementById("status").value;
  const imageFiles = Array.from(imageInput.files);
  const videoFile = videoInput.files[0];
  const maxSize = 20 * 1024 * 1024;

  if (!name || !price || !category) {
    alert("Please fill all required fields.");
    return;
  }

  if (productType.value === "bale" && !weight) {
    alert("Please enter the bale weight.");
    return;
  }

  if (productType.value === "single" && !size) {
    alert("Please select a dress size.");
    return;
  }

  if (!imageFiles.length && !videoFile) {
    alert("Please select at least one image or one video.");
    return;
  }

  if (!imageFiles.length && videoFile && !isFashionVideoOnlyAllowed(productType.value, category, description, name)) {
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
  formData.append("weight", productType.value === "bale" ? weight : size);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("status", status);
  formData.append("type", productType.value);
  formData.append("sellerId", currentUser.id);
  formData.append("sellerName", currentUser.name || "");

  imageFiles.forEach(imageFile => formData.append("image", imageFile));
  if (videoFile) {
    formData.append("video", videoFile);
  }

  const uploadEndpoint = !imageFiles.length && videoFile
    ? `${API_BASE}/api/triciabales/upload/video-only`
    : `${API_BASE}/api/triciabales/upload`;

  addBaleBtn.disabled = true;
  addBaleBtn.textContent = productType.value === "bale" ? "Uploading Bale..." : "Uploading Dress...";
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

    alert(productType.value === "bale" ? "Bale uploaded successfully." : "Dress uploaded successfully.");
    resetUploadForm();
    loadManageProducts();
  } catch (err) {
    console.error("Upload error:", err);
    alert(`Upload failed.\n\n${err.message}`);
  } finally {
    addBaleBtn.disabled = false;
    addBaleBtn.textContent = productType.value === "bale" ? "Upload Bale" : "Upload Dress";
    progressWrap.style.display = "none";
    statusText.style.display = "none";
  }
});

payoutCards.forEach(card => {
  card.addEventListener("click", () => {
    togglePayoutFields(card.dataset.method);
  });
});

["momoNetwork", "momoNumber", "bankName", "bankAccountNumber", "bankAccountName"].forEach(id => {
  document.getElementById(id).addEventListener("input", updatePayoutPreview);
  document.getElementById(id).addEventListener("change", updatePayoutPreview);
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
    bankAccountNumber: document.getElementById("bankAccountNumber").value.trim() || null,
    bankAccountName: document.getElementById("bankAccountName").value.trim() || null
  };

  if (method === "momo" && (!payload.momoNetwork || !payload.momoNumber)) {
    alert("Please enter your MoMo network and number.");
    return;
  }

  if (method === "bank" && (!payload.bankName || !payload.bankAccountNumber || !payload.bankAccountName)) {
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
setUploadMode("bale");
showSection("upload");
