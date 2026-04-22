const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const API_BASE = "/triciabales-api";
const payoutForm = document.getElementById("payout-form");
const payoutMethod = document.getElementById("payoutMethod");
const momoFields = document.getElementById("momoFields");
const bankFields = document.getElementById("bankFields");

if (currentUser?.role === "SELLER") {
  window.location.href = "/store/seller-dashboard";
}

if (!currentUser || currentUser.role !== "SELLER") {
  alert("Please login as a seller first.");
  window.location.href = "/store/buyer-login";
}

document.getElementById("seller-name").textContent = currentUser?.name || "Seller";
document.getElementById("seller-email").textContent = currentUser?.email || "";

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

function togglePayoutFields(method) {
  momoFields.classList.toggle("hidden-panel", method !== "momo");
  bankFields.classList.toggle("hidden-panel", method !== "bank");
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
  } catch (err) {
    console.error(err);
    bankSelect.innerHTML = '<option value="">Unable to load banks</option>';
  }
}

function hydrateForm() {
  payoutMethod.value = currentUser?.payoutMethod || "";
  document.getElementById("momoNetwork").value = currentUser?.momoNetwork || "";
  document.getElementById("momoNumber").value = currentUser?.momoNumber || "";
  document.getElementById("bankName").value = currentUser?.bankName || "";
  document.getElementById("bankCode").value = currentUser?.bankCode || "";
  document.getElementById("bankAccountNumber").value = currentUser?.bankAccountNumber || "";
  document.getElementById("bankAccountName").value = currentUser?.bankAccountName || "";
  togglePayoutFields(payoutMethod.value);
}

payoutMethod.addEventListener("change", () => {
  togglePayoutFields(payoutMethod.value);
});

document.getElementById("bankCode").addEventListener("change", event => {
  const selected = event.target.selectedOptions[0];
  if (selected?.dataset.name) {
    document.getElementById("bankName").value = selected.dataset.name;
  }
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

hydrateForm();
loadPaystackBanks();
