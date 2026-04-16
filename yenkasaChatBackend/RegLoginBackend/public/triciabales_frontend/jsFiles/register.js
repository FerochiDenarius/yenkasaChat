function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

const roleSelect = document.getElementById("role");
const sellerKycSection = document.getElementById("seller-kyc-fields");
const registerForm = document.getElementById("register-form");

function toggleSellerFields() {
  if (!roleSelect || !sellerKycSection) {
    return;
  }

  const isSeller = String(roleSelect.value || "").toUpperCase() === "SELLER";

  sellerKycSection.classList.toggle("hidden", !isSeller);
  sellerKycSection.setAttribute("aria-hidden", String(!isSeller));
  sellerKycSection.style.display = isSeller ? "grid" : "none";

  sellerKycSection
    .querySelectorAll("input, select, textarea")
    .forEach((field) => {
      field.required = isSeller;
    });
}

if (roleSelect && sellerKycSection) {
  roleSelect.addEventListener("change", toggleSellerFields);
  roleSelect.addEventListener("input", toggleSellerFields);
  toggleSellerFields();
  window.addEventListener("pageshow", toggleSellerFields);
  setTimeout(toggleSellerFields, 250);
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    const role = getInputValue("role");

    const formData = new FormData();

    formData.append("name", getInputValue("name"));
    formData.append("email", getInputValue("email"));
    formData.append("phone", getInputValue("phone"));
    formData.append("address", getInputValue("address"));
    formData.append("role", role);
    formData.append("referralCode", getInputValue("referralCode"));
    formData.append("password", document.getElementById("password").value);

    if (role === "SELLER") {
      const dateOfBirth = getInputValue("dateOfBirth");
      const shopAddress = getInputValue("shopAddress");

      formData.append("dateOfBirth", dateOfBirth);
      formData.append("dob", dateOfBirth);
      formData.append("idType", getInputValue("idType"));
      formData.append("idNumber", getInputValue("idNumber"));
      formData.append("shopName", getInputValue("shopName"));
      formData.append("shopAddress", shopAddress);
      formData.append("shopLocation", shopAddress);
      formData.append("proofOfOperation", getInputValue("proofOfOperation"));

      const idImage = document.getElementById("idImage")?.files?.[0];
      if (idImage) {
        formData.append("idImage", idImage);
      }
    }

    try {
      submitButton.disabled = true;
      submitButton.textContent = "Creating account...";

      const response = await fetch("/triciabales-api/api/users/register", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Registration failed");
      }

      alert(
        data.message ||
          "Account created successfully. Please verify your email."
      );

      window.location.href = "/store/buyer-login";
    } catch (err) {
      console.error(err);
      alert(err.message || "Something went wrong");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
}
