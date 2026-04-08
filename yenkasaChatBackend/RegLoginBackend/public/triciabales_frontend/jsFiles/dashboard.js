const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const payoutForm = document.getElementById("payout-form");
const payoutMethod = document.getElementById("payoutMethod");
const momoFields = document.getElementById("momoFields");
const bankFields = document.getElementById("bankFields");

if (!currentUser || currentUser.role !== "SELLER") {
  alert("Please login as a seller first.");
  window.location.href = "buyer-login.html";
}

document.getElementById("seller-name").textContent = currentUser?.name || "Seller";
document.getElementById("seller-email").textContent = currentUser?.email || "";

function togglePayoutFields(method) {
  momoFields.classList.toggle("hidden-panel", method !== "momo");
  bankFields.classList.toggle("hidden-panel", method !== "bank");
}

function hydrateForm() {
  payoutMethod.value = currentUser?.payoutMethod || "";
  document.getElementById("momoNetwork").value = currentUser?.momoNetwork || "";
  document.getElementById("momoNumber").value = currentUser?.momoNumber || "";
  document.getElementById("bankName").value = currentUser?.bankName || "";
  document.getElementById("bankAccountNumber").value = currentUser?.bankAccountNumber || "";
  document.getElementById("bankAccountName").value = currentUser?.bankAccountName || "";
  togglePayoutFields(payoutMethod.value);
}

payoutMethod.addEventListener("change", () => {
  togglePayoutFields(payoutMethod.value);
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
  } catch (err) {
    console.error(err);
    alert("Unable to save payout details.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Payout Details";
  }
});

hydrateForm();
