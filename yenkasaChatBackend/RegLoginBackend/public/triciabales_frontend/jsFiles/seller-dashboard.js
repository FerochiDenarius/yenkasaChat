const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const menuButtons = document.querySelectorAll(".seller-menu-btn");
const panels = document.querySelectorAll(".seller-panel");
const sellerMenu = document.getElementById("sellerMenu");
const sellerMenuToggle = document.getElementById("sellerMenuToggle");
const imageInput = document.getElementById("imageFile");
const videoInput = document.getElementById("videoFile");
const imagePreview = document.getElementById("imagePreview");
const videoPreview = document.getElementById("videoPreview");
const addBaleBtn = document.getElementById("addBaleBtn");
const progressWrap = document.getElementById("progressWrap");
const statusText = document.getElementById("statusText");
const imageInputDress = document.getElementById("imageFileDress");
const videoInputDress = document.getElementById("videoFileDress");
const imagePreviewDress = document.getElementById("imagePreviewDress");
const videoPreviewDress = document.getElementById("videoPreviewDress");
const addDressBtn = document.getElementById("addDressBtn");
const progressWrapDress = document.getElementById("progressWrapDress");
const statusTextDress = document.getElementById("statusTextDress");
const productType = document.getElementById("productType");
const weightField = document.getElementById("weightField");
const sizeField = document.getElementById("sizeField");
const manageList = document.getElementById("manageList");
const sellerOrdersList = document.getElementById("seller-orders-list");
const sellerOrdersFeedback = document.getElementById("seller-orders-feedback");
const pendingPayoutsList = document.getElementById("pending-payouts-list");
const payoutForm = document.getElementById("payout-form");
const payoutMethod = document.getElementById("payoutMethod");
const momoFields = document.getElementById("momoFields");
const bankFields = document.getElementById("bankFields");
const payoutCards = document.querySelectorAll(".payout-card");
const previewMethod = document.getElementById("preview-method");
const previewAccount = document.getElementById("preview-account");

if (!currentUser) {
  window.location.href = "buyer-login.html";
}

if (currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN") {
  window.location.href = "admin.html";
}

if (currentUser?.role !== "SELLER") {
  window.location.href = "buyer-login.html";
}

document.getElementById("seller-name").textContent = currentUser?.name || "Seller";
document.getElementById("seller-email").textContent = currentUser?.email || "";

function openPanel(panelName) {
  menuButtons.forEach(button => button.classList.remove("active"));
  panels.forEach(panel => panel.classList.remove("active"));

  const activeButton = Array.from(menuButtons).find(button => button.dataset.panel === panelName);
  const activePanel = document.getElementById(`panel-${panelName}`);

  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (activePanel) {
    activePanel.classList.add("active");
  }

  if (panelName === "manage-products") {
    loadManageProducts();
  }

  if (panelName === "my-orders") {
    loadSellerOrders();
  }
}

function switchProductMode(mode) {
  productType.value = mode;
  const isBale = mode === "bale";

  weightField.style.display = isBale ? "flex" : "none";
  sizeField.style.display = isBale ? "none" : "flex";

  document.querySelector("label[for='name']").textContent = isBale ? "Bale Name" : "Dress Name";
  document.getElementById("name").placeholder = isBale
    ? "e.g. Ladies Flannel Blouse Bale"
    : "e.g. Floral Summer Dress";
  addBaleBtn.textContent = isBale ? "Upload Bale" : "Upload Dress";
}

function togglePayoutFields(method) {
  payoutCards.forEach(card => {
    card.classList.toggle("active", card.dataset.method === method);
  });

  momoFields.classList.toggle("hidden-panel", method !== "momo");
  bankFields.classList.toggle("hidden-panel", method !== "bank");
  payoutMethod.value = method || "";
  updatePayoutPreview();
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

function updatePayoutPreview() {
  const method = payoutMethod.value;

  if (method === "momo") {
    const network = document.getElementById("momoNetwork").value || "Mobile Money";
    const number = document.getElementById("momoNumber").value.trim();

    previewMethod.textContent = `Method: ${network}`;
    previewAccount.textContent = number
      ? `Account: ${number}`
      : "Enter your MoMo number to preview where your payouts will go.";
    return;
  }

  if (method === "bank") {
    const bankName = document.getElementById("bankName").value.trim();
    const accountName = document.getElementById("bankAccountName").value.trim();
    const accountNumber = document.getElementById("bankAccountNumber").value.trim();

    previewMethod.textContent = bankName
      ? `Method: ${bankName}`
      : "Method: Bank Transfer";
    previewAccount.textContent = accountNumber || accountName
      ? `Account: ${accountName || "Account Name"} ${accountNumber ? `• ${accountNumber}` : ""}`.trim()
      : "Enter your bank details to preview the payout destination.";
    return;
  }

  previewMethod.textContent = "No payout method selected";
  previewAccount.textContent = "";
}

function formatStatus(status) {
  if (!status) return "-";

  return status
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusClass(type, value) {
  const normalized = (value || "").toLowerCase();

  if (type === "payment") {
    if (normalized === "paid" || normalized === "payout_released") return "paid";
    if (
      normalized === "awaiting_payment" ||
      normalized === "awaiting_transfer" ||
      normalized === "ready_for_payout"
    ) {
      return "awaiting";
    }
    return "unpaid";
  }

  if (normalized === "delivered") return "paid";
  if (normalized === "accepted") return "awaiting";
  return "unpaid";
}

function estimateSellerPayout(order) {
  if (order.sellerPayoutAmount != null) {
    return Number(order.sellerPayoutAmount || 0);
  }

  const total = Number(order.total || 0);
  return total - (total * 0.10);
}

function setSummary(orders) {
  const totalOrders = orders.length;
  const estimatedEarnings = orders.reduce(
    (sum, order) => sum + estimateSellerPayout(order),
    0
  );
  const pendingPayouts = orders
    .filter(order => order.paymentStatus !== "payout_released")
    .reduce((sum, order) => sum + estimateSellerPayout(order), 0);

  document.getElementById("seller-total-orders").textContent = totalOrders;
  document.getElementById("seller-estimated-earnings").textContent = `GH₵${estimatedEarnings.toFixed(2)}`;
  document.getElementById("seller-pending-payouts").textContent = `GH₵${pendingPayouts.toFixed(2)}`;
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

function resetDressForm() {
  document.getElementById("nameDress").value = "";
  document.getElementById("priceDress").value = "";
  document.getElementById("sizeDress").value = "";
  document.getElementById("categoryDress").value = "";
  document.getElementById("descriptionDress").value = "";
  document.getElementById("statusDress").value = "available";
  imageInputDress.value = "";
  videoInputDress.value = "";
  imagePreviewDress.innerHTML = "";
  imagePreviewDress.style.display = "none";
  videoPreviewDress.style.display = "none";
  videoPreviewDress.removeAttribute("src");
}

function renderPendingPayouts(orders) {
  const pendingOrders = orders.filter(order => order.paymentStatus !== "payout_released");

  if (!pendingOrders.length) {
    pendingPayoutsList.innerHTML = "<p>There are no pending payouts right now.</p>";
    return;
  }

  pendingPayoutsList.innerHTML = pendingOrders.map(order => `
    <div class="payout-line">
      <div>
        <strong>Order #${order.id}</strong>
        <p>${formatStatus(order.paymentStatus)} / ${formatStatus(order.deliveryStatus)}</p>
      </div>
      <strong>GH₵${estimateSellerPayout(order).toFixed(2)}</strong>
    </div>
  `).join("");
}

function renderOrders(orders) {
  if (!orders.length) {
    sellerOrdersFeedback.classList.remove("hidden");
    sellerOrdersFeedback.innerHTML = `
      <div class="card">
        <div class="card-content">
          <h3>No seller orders yet.</h3>
          <p>Your linked orders will appear here after buyers place orders for your products.</p>
        </div>
      </div>
    `;
    sellerOrdersList.innerHTML = "";
    return;
  }

  sellerOrdersFeedback.classList.add("hidden");
  sellerOrdersList.innerHTML = orders.map(order => {
    const deliveryStatus = order.deliveryStatus || "pending";
    const paymentStatus = order.paymentStatus || "pending";
    const acceptedBtn = deliveryStatus !== "accepted" && deliveryStatus !== "delivered"
      ? `<button class="primary-btn seller-order-btn" data-id="${order.id}" data-action="accept">Mark Accepted</button>`
      : "";
    const deliveredBtn = deliveryStatus !== "delivered"
      ? `<button class="secondary-btn seller-order-btn" data-id="${order.id}" data-action="deliver">Mark Delivered</button>`
      : "";

    return `
      <article class="seller-order-card">
        <div class="seller-order-top">
          <div>
            <p class="order-label">Order #${order.id}</p>
            <h3>${order.customerName || "Customer"}</h3>
          </div>
          <div class="order-total">GH₵${Number(order.total || 0).toFixed(2)}</div>
        </div>

        <div class="order-meta">
          <span class="status-pill ${getStatusClass("payment", paymentStatus)}">
            Payment: ${formatStatus(paymentStatus)}
          </span>
          <span class="status-pill ${getStatusClass("delivery", deliveryStatus)}">
            Delivery: ${formatStatus(deliveryStatus)}
          </span>
        </div>

        <div class="seller-order-meta">
          <p><strong>Customer:</strong> ${order.customerName || "-"}</p>
          <p><strong>Phone:</strong> ${order.phone || "-"}</p>
          <p><strong>Address:</strong> ${order.address || "-"}</p>
          <p><strong>Estimated Payout:</strong> GH₵${estimateSellerPayout(order).toFixed(2)}</p>
        </div>

        <div class="seller-order-items">
          ${(order.items || []).map(item => `
            <div class="order-item-row">
              <span>${item.baleName}</span>
              <span>${item.quantity} x GH₵${Number(item.price || 0).toFixed(2)}</span>
            </div>
          `).join("")}
        </div>

        <div class="seller-order-actions">
          ${acceptedBtn}
          ${deliveredBtn}
        </div>
      </article>
    `;
  }).join("");
}

async function loadSellerOrders() {
  try {
    const response = await fetch(
      `https://www.yenkasa.xyz/triciabales-api/api/orders/seller/${currentUser.id}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load seller orders");
    }

    setSummary(data);
    renderPendingPayouts(data);
    renderOrders(data);
  } catch (err) {
    console.error(err);
    sellerOrdersFeedback.classList.remove("hidden");
    sellerOrdersFeedback.innerHTML = `
      <div class="card">
        <div class="card-content">
          <h3>Could not load your seller orders right now.</h3>
        </div>
      </div>
    `;
    sellerOrdersList.innerHTML = "";
    pendingPayoutsList.innerHTML = "<p>Unable to load pending payouts.</p>";
  }
}

async function loadManageProducts() {
  manageList.innerHTML = "<p>Loading products...</p>";

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/triciabales"
    );
    const products = await response.json();

    if (!response.ok) {
      throw new Error("Could not load products");
    }

    const sellerProducts = products.filter(item => Number(item.sellerId) === Number(currentUser.id));

    if (!sellerProducts.length) {
      manageList.innerHTML = "<p>You have not uploaded any products yet.</p>";
      return;
    }

    manageList.innerHTML = sellerProducts.map(item => `
      <div class="manage-item">
        <div style="display:flex; align-items:center; gap:12px;">
          <img
            src="${item.imageUrl}"
            alt="${item.name}"
            style="
              width:60px;
              height:60px;
              object-fit:cover;
              border-radius:12px;
              border:1px solid #eee;
            "
          >

          <div class="manage-info">
            <strong>${item.name}</strong>
            <small>${item.type} • ${item.status}</small>
          </div>
        </div>

        <div class="manage-actions">
          <button class="manage-btn status" data-action="status" data-id="${item.id}">
            ${item.status === "sold" ? "Mark Available" : "Mark Sold"}
          </button>

          <button class="manage-btn delete" data-action="delete" data-id="${item.id}">
            Delete
          </button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
    manageList.innerHTML = "<p>Unable to load your products.</p>";
  }
}

async function markSold(id) {
  try {
    const response = await fetch(
      `https://www.yenkasa.xyz/triciabales-api/api/triciabales/${id}/status`,
      {
        method: "PUT"
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
      `https://www.yenkasa.xyz/triciabales-api/api/triciabales/${id}`,
      {
        method: "DELETE"
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

menuButtons.forEach(button => {
  button.addEventListener("click", () => {
    openPanel(button.dataset.panel);

    if (window.innerWidth <= 768) {
      sellerMenu.classList.remove("open");
    }
  });
});

sellerMenuToggle.addEventListener("click", () => {
  sellerMenu.classList.toggle("open");
});

payoutCards.forEach(card => {
  card.addEventListener("click", () => {
    togglePayoutFields(card.dataset.method);
  });
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

imageInputDress.addEventListener("change", () => {
  imagePreviewDress.innerHTML = "";

  if (!imageInputDress.files.length) {
    imagePreviewDress.style.display = "none";
    return;
  }

  imagePreviewDress.style.display = "grid";

  Array.from(imageInputDress.files).forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    imagePreviewDress.appendChild(img);
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

videoInputDress.addEventListener("change", () => {
  const file = videoInputDress.files[0];

  if (!file) {
    videoPreviewDress.style.display = "none";
    videoPreviewDress.removeAttribute("src");
    return;
  }

  videoPreviewDress.src = URL.createObjectURL(file);
  videoPreviewDress.style.display = "block";
});

addBaleBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value.trim();
  const weight = document.getElementById("weight").value.trim();
  const category = document.getElementById("category").value.trim();
  const description = document.getElementById("description").value.trim();
  const status = document.getElementById("status").value;
  const size = document.getElementById("size").value;
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

  if (!imageFiles.length) {
    alert("Please select at least one image.");
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

  imageFiles.forEach(imageFile => {
    formData.append("image", imageFile);
  });

  if (videoFile) {
    formData.append("video", videoFile);
  }

  addBaleBtn.disabled = true;
  addBaleBtn.textContent = productType.value === "bale" ? "Uploading Bale..." : "Uploading Dress...";
  progressWrap.style.display = "block";
  statusText.style.display = "block";

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/triciabales/upload",
      {
        method: "POST",
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

addDressBtn.addEventListener("click", async () => {
  const name = document.getElementById("nameDress").value.trim();
  const price = document.getElementById("priceDress").value.trim();
  const size = document.getElementById("sizeDress").value;
  const category = document.getElementById("categoryDress").value.trim();
  const description = document.getElementById("descriptionDress").value.trim();
  const status = document.getElementById("statusDress").value;
  const imageFiles = Array.from(imageInputDress.files);
  const videoFile = videoInputDress.files[0];
  const maxSize = 20 * 1024 * 1024;

  if (!name || !price || !category) {
    alert("Please fill all required fields.");
    return;
  }

  if (!size) {
    alert("Please select a dress size.");
    return;
  }

  if (!imageFiles.length) {
    alert("Please select at least one image.");
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
  formData.append("weight", size);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("status", status);
  formData.append("type", "single");
  formData.append("sellerId", currentUser.id);
  formData.append("sellerName", currentUser.name || "");

  imageFiles.forEach(imageFile => {
    formData.append("image", imageFile);
  });

  if (videoFile) {
    formData.append("video", videoFile);
  }

  addDressBtn.disabled = true;
  addDressBtn.textContent = "Uploading Dress...";
  progressWrapDress.style.display = "block";
  statusTextDress.style.display = "block";

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/triciabales/upload",
      {
        method: "POST",
        body: formData
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText}`);
    }

    alert("Dress uploaded successfully.");
    resetDressForm();
    loadManageProducts();
  } catch (err) {
    console.error("Upload error:", err);
    alert(`Upload failed.\n\n${err.message}`);
  } finally {
    addDressBtn.disabled = false;
    addDressBtn.textContent = "Upload Dress";
    progressWrapDress.style.display = "none";
    statusTextDress.style.display = "none";
  }
});

manageList.addEventListener("click", event => {
  const button = event.target.closest(".manage-btn");

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  if (!id) {
    return;
  }

  if (action === "status") {
    markSold(Number(id));
  }

  if (action === "delete") {
    deleteProduct(Number(id));
  }
});

sellerOrdersList.addEventListener("click", async event => {
  const button = event.target.closest(".seller-order-btn");

  if (!button) {
    return;
  }

  const orderId = button.dataset.id;
  const action = button.dataset.action;

  if (!orderId || !action) {
    return;
  }

  try {
    const body = action === "accept"
      ? { deliveryStatus: "accepted" }
      : { deliveryStatus: "delivered" };

    const response = await fetch(
      `https://www.yenkasa.xyz/triciabales-api/api/orders/${orderId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
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

payoutMethod.addEventListener("change", () => {
  togglePayoutFields(payoutMethod.value);
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
      "https://www.yenkasa.xyz/triciabales-api/api/seller/payout-details",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not save payout details");
    }

    localStorage.setItem("currentUser", JSON.stringify(data));
    alert("Payout details saved successfully.");
    window.location.href = "seller-dashboard.html";
  } catch (err) {
    console.error(err);
    alert("Unable to save payout details.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Payout Details";
  }
});

hydratePayoutForm();
switchProductMode("bale");
loadSellerOrders();
