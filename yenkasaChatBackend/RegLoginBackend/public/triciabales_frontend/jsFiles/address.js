const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
const authToken = localStorage.getItem("authToken") || "";
const API_BASE = "/triciabales-api";
const addressField = document.getElementById("address");
const suggestionsBox = document.getElementById("address-suggestions");
let selectedPlace = null;
let suggestionTimer = null;

if (currentUser) {
  document.getElementById("customerName").value = currentUser.name || "";
  document.getElementById("phone").value = currentUser.phone || "";
  addressField.value = currentUser.address || "";
}

addressField.addEventListener("input", () => {
  selectedPlace = null;
  clearTimeout(suggestionTimer);
  const input = addressField.value.trim();

  if (input.length < 3 || !authToken) {
    hideSuggestions();
    return;
  }

  suggestionTimer = setTimeout(() => loadPlaceSuggestions(input), 300);
});

document.addEventListener("click", event => {
  if (!suggestionsBox.contains(event.target) && event.target !== addressField) {
    hideSuggestions();
  }
});

document.getElementById("address-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    customerName: document.getElementById("customerName").value,
    phone: document.getElementById("phone").value,
    region: document.getElementById("region").value,
    area: document.getElementById("area").value,
    landmark: document.getElementById("landmark").value,
    address: addressField.value,
    placeId: selectedPlace?.placeId || null,
    formattedAddress: selectedPlace?.description || addressField.value,
    notes: document.getElementById("notes").value
  };

  localStorage.setItem("checkoutAddress", JSON.stringify(data));

  window.location.href = "/store/delivery";
});

async function loadPlaceSuggestions(input) {
  try {
    const response = await fetch(`${API_BASE}/api/delivery/places?input=${encodeURIComponent(input)}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load locations");
    }

    renderSuggestions(Array.isArray(data.predictions) ? data.predictions : []);
  } catch (err) {
    console.error(err);
    hideSuggestions();
  }
}

function renderSuggestions(predictions) {
  if (!predictions.length) {
    hideSuggestions();
    return;
  }

  suggestionsBox.innerHTML = predictions.map((prediction, index) => `
    <button
      type="button"
      class="address-suggestion"
      data-index="${index}"
      style="display:block;width:100%;padding:12px;text-align:left;border:0;border-bottom:1px solid #e5e7eb;background:#fff;cursor:pointer;"
    >
      <strong>${escapeHtml(prediction.mainText || prediction.description)}</strong>
      <span style="display:block;color:#6b7280;margin-top:4px;">${escapeHtml(prediction.secondaryText || "")}</span>
    </button>
  `).join("");

  suggestionsBox.querySelectorAll(".address-suggestion").forEach(button => {
    button.addEventListener("click", () => {
      const prediction = predictions[Number(button.dataset.index)];
      selectedPlace = prediction;
      addressField.value = prediction.description;
      hideSuggestions();
    });
  });

  suggestionsBox.style.display = "block";
}

function hideSuggestions() {
  suggestionsBox.style.display = "none";
  suggestionsBox.innerHTML = "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
