const imageInput = document.getElementById("imageFile");
const videoInput = document.getElementById("videoFile");
const imagePreview = document.getElementById("imagePreview");
const videoPreview = document.getElementById("videoPreview");
const addBaleBtn = document.getElementById("addBaleBtn");
const progressWrap = document.getElementById("progressWrap");
const statusText = document.getElementById("statusText");
const baleTab = document.getElementById("baleTab");
const singleTab = document.getElementById("singleTab");
const productType = document.getElementById("productType");
const weightField = document.getElementById("weightField");
const sizeField = document.getElementById("sizeField");
const manageTab = document.getElementById("manageTab");
const ordersTab = document.getElementById("ordersTab");
const manageSection = document.getElementById("manageSection");
const ordersSection = document.getElementById("ordersSection");
const manageList = document.getElementById("manageList");
const sellerOrdersList = document.getElementById("sellerOrdersList");
const paidCount = document.getElementById("paid-count");
const pendingCount = document.getElementById("pending-count");
const completedCount = document.getElementById("completed-count");
const uploadCard = document.querySelector(".card");
const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const hasLegacyAdminSession = localStorage.getItem("loggedIn") === "true";
const isAdminRole = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";
const canAccessAdmin = hasLegacyAdminSession || isAdminRole;
const canReleasePayout = currentUser?.role === "SUPER_ADMIN";

if (currentUser?.role === "SELLER") {
  window.location.href = "seller-dashboard.html";
} else if (!canAccessAdmin) {
  window.location.href = "login.html";
}

baleTab.addEventListener("click", () => {
  manageTab.classList.remove("active");
  ordersTab.classList.remove("active");
  uploadCard.style.display = "block";
  manageSection.style.display = "none";
  ordersSection.style.display = "none";

  baleTab.classList.add("active");
  singleTab.classList.remove("active");

  productType.value = "bale";
  weightField.style.display = "flex";
  sizeField.style.display = "none";

  document.querySelector("label[for='name']").textContent = "Bale Name";
  document.getElementById("name").placeholder = "e.g. Ladies Flannel Blouse Bale";
  addBaleBtn.textContent = "Upload Bale";
});

singleTab.addEventListener("click", () => {
  manageTab.classList.remove("active");
  ordersTab.classList.remove("active");
  uploadCard.style.display = "block";
  manageSection.style.display = "none";
  ordersSection.style.display = "none";
  singleTab.classList.add("active");
  baleTab.classList.remove("active");
  
productType.value = "single";
weightField.style.display = "none";
sizeField.style.display = "flex";

  document.querySelector("label[for='name']").textContent = "Dress Name";
  document.getElementById("name").placeholder = "e.g. Floral Summer Dress";
  addBaleBtn.textContent = "Upload Dress";
});

manageTab.addEventListener("click", () => {
  manageTab.classList.add("active");
  ordersTab.classList.remove("active");
  baleTab.classList.remove("active");
  singleTab.classList.remove("active");

  uploadCard.style.display = "none";
  manageSection.style.display = "block";
  ordersSection.style.display = "none";

  loadManageProducts();
});

ordersTab.addEventListener("click", () => {
  ordersTab.classList.add("active");
  manageTab.classList.remove("active");
  baleTab.classList.remove("active");
  singleTab.classList.remove("active");

  uploadCard.style.display = "none";
  manageSection.style.display = "none";
  ordersSection.style.display = "block";

  loadSellerOrders();
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
  const button = event.target.closest(
    ".order-action-btn, .accept-order-btn, .deliver-order-btn, .release-payment-btn"
  );

  if (!button) return;

  const orderId = button.dataset.id;
  const action = button.dataset.action ||
    (button.classList.contains("accept-order-btn") ? "accept" : "") ||
    (button.classList.contains("deliver-order-btn") ? "deliver" : "");

  if (!orderId || !action) return;

  try {
    let body = {};

    if (action === "accept") {
      body = {
        deliveryStatus: "accepted"
      };
    }

    if (action === "deliver") {
      body = {
        deliveryStatus: "delivered"
      };
    }

    if (action === "release") {
      const confirmed = confirm(
        "Release seller payment after deducting 10% commission?"
      );

      if (!confirmed) {
        return;
      }

      body = {
        releasePayout: "true"
      };
    }

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

    const updatedOrder = await response.json();

    if (action === "release") {
      alert(
        `Seller payout released.\n\nCommission: GH₵${Number(updatedOrder.commissionAmount || 0).toFixed(2)}\nSeller Gets: GH₵${Number(updatedOrder.sellerPayoutAmount || 0).toFixed(2)}`
      );
      loadSellerOrders();
      return;
    }

    alert(
      action === "accept"
        ? "Order marked as accepted."
        : "Order marked as delivered."
    );
    loadSellerOrders();
  } catch (err) {
    console.error(err);
    alert("Unable to update order status.");
  }
});

// Image preview
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

// Video preview
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

// Upload Bale
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

  const MAX_SIZE = 20 * 1024 * 1024;

  // Validation
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
    if (imageFile.size > MAX_SIZE) {
      alert("One of the images is too large. Maximum size is 20MB.");
      return;
    }
  }

  if (videoFile && videoFile.size > MAX_SIZE) {
    alert("Video is too large. Maximum size is 20MB.");
    return;
  }

  // Prepare form data
  const formData = new FormData();
  formData.append("name", name);
  formData.append("price", price);
if (productType.value === "bale") {
  formData.append("weight", weight);
} else {
  formData.append("weight", size);
}  formData.append("category", category);
formData.append("description", description);
formData.append("status", status);
formData.append("type", productType.value);

  if (currentUser?.id) {
    formData.append("sellerId", currentUser.id);
    formData.append("sellerName", currentUser.name || "");
  }

  imageFiles.forEach(imageFile => {
    formData.append("image", imageFile);
  });


  if (videoFile) {
    formData.append("video", videoFile);
  }

  // UI loading state
  addBaleBtn.disabled = true;
  addBaleBtn.textContent = "Uploading...";
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

    console.log("Upload status:", response.status);
    console.log("Upload response:", rawText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText}`);
    }

    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { success: true };
    }

    alert("✅ Bale uploaded successfully!");

    // Reset form
    document.getElementById("name").value = "";
    document.getElementById("price").value = "";
    document.getElementById("weight").value = "";
    document.getElementById("category").value = "";
    document.getElementById("description").value = "";
    document.getElementById("status").value = "available";

    imageInput.value = "";
    videoInput.value = "";

    imagePreview.style.display = "none";
    imagePreview.innerHTML = "";

    videoPreview.style.display = "none";
    videoPreview.removeAttribute("src");

  } catch (err) {
    console.error("Upload error:", err);
    alert(`❌ Upload failed.\n\n${err.message}`);
  } finally {
    addBaleBtn.disabled = false;
    addBaleBtn.textContent = "Upload Bale";
    progressWrap.style.display = "none";
    statusText.style.display = "none";
  }
});

async function loadManageProducts() {
  manageList.innerHTML = "<p>Loading products...</p>";

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/triciabales"
    );

    const products = await response.json();

    if (!products.length) {
      manageList.innerHTML = "<p>No products found.</p>";
      return;
    }

    manageList.innerHTML = products.map(item => `
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
    manageList.innerHTML = "<p>Unable to load products.</p>";
  }
}

async function loadSellerOrders() {
  sellerOrdersList.innerHTML = "<p>Loading orders...</p>";

  try {
    const ordersUrl = currentUser?.role === "SELLER"
      ? `https://www.yenkasa.xyz/triciabales-api/api/orders/seller/${currentUser.id}`
      : "https://www.yenkasa.xyz/triciabales-api/api/orders";
    const response = await fetch(ordersUrl);

    if (!response.ok) {
      throw new Error("Unable to load orders");
    }

    const orders = await response.json();

    const paidOrders = orders.filter(
      order => order.paymentStatus === "paid"
    );

    const awaitingOrders = orders.filter(
      order => order.paymentStatus === "awaiting_payment"
    );

    const completedOrders = orders.filter(
      order => order.deliveryStatus === "delivered"
    );

    paidCount.textContent = paidOrders.length;
    pendingCount.textContent = awaitingOrders.length;
    completedCount.textContent = completedOrders.length;

    if (!orders.length) {
      sellerOrdersList.innerHTML = "<p>No orders found.</p>";
      return;
    }

    sellerOrdersList.innerHTML = orders.map(order => {
      const total = Number(order.total || 0);
      const commission = total * 0.10;
      const sellerReceives = total - commission;
      const deliveryStatus = order.deliveryStatus || "pending";
      const paymentStatus = order.paymentStatus || "pending";
      const acceptedBtn = deliveryStatus !== "accepted" && deliveryStatus !== "delivered"
        ? `
            <button
              class="manage-btn status order-action-btn accept-order-btn"
              data-id="${order.id}"
              data-action="accept"
            >
              Mark Accepted
            </button>
          `
        : "";
      const deliveredBtn = deliveryStatus !== "delivered"
        ? `
            <button
              class="manage-btn status order-action-btn deliver-order-btn"
              data-id="${order.id}"
              data-action="deliver"
            >
              Mark Delivered
            </button>
          `
        : "";
      const releasePaymentBtn = canReleasePayout &&
        paymentStatus === "ready_for_payout" &&
        order.confirmedByBuyer === true
        ? `
            <button
              class="manage-btn status order-action-btn release-payment-btn"
              data-id="${order.id}"
              data-action="release"
            >
              Release Seller Payment
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
            <p><strong>Delivery:</strong> ${order.deliveryStatus || "-"}</p>
            <p><strong>Buyer Confirmed:</strong> ${order.confirmedByBuyer ? "Yes" : "No"}</p>
            <p><strong>Total:</strong> GH₵${total.toFixed(2)}</p>
            <p><strong>Commission (10%):</strong> GH₵${commission.toFixed(2)}</p>
            <p><strong>Seller Receives:</strong> GH₵${sellerReceives.toFixed(2)}</p>
            ${order.commissionAmount != null ? `
              <p><strong>Released Commission:</strong> GH₵${Number(order.commissionAmount).toFixed(2)}</p>
            ` : ""}
            ${order.sellerPayoutAmount != null ? `
              <p><strong>Released Seller Payout:</strong> GH₵${Number(order.sellerPayoutAmount).toFixed(2)}</p>
            ` : ""}
          </div>

          <div class="manage-actions" style="margin-top:12px;">
            ${acceptedBtn}
            ${deliveredBtn}
            ${releasePaymentBtn}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    sellerOrdersList.innerHTML =
      "<p>Unable to load seller orders.</p>";
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
