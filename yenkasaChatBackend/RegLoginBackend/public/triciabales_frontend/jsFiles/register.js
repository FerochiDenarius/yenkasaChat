function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

const roleSelect = document.getElementById("role");
const sellerKycSection = document.getElementById("seller-kyc-section");

function toggleSellerFields() {
  const isSeller = roleSelect.value === "SELLER";

  if (sellerKycSection) {
    sellerKycSection.style.display = isSeller ? "flex" : "none";
  }

  const sellerFields = sellerKycSection.querySelectorAll(
    "input, select, textarea"
  );

  sellerFields.forEach((field) => {
    field.required = isSeller;
  });
}

if (roleSelect && sellerKycSection) {
  roleSelect.addEventListener("change", toggleSellerFields);
  toggleSellerFields();
}

document
  .getElementById("register-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    const formData = new FormData();

    formData.append("name", getInputValue("name"));
    formData.append("email", getInputValue("email"));
    formData.append("phone", getInputValue("phone"));
    formData.append("address", getInputValue("address"));
    formData.append("role", getInputValue("role"));
    formData.append("referralCode", getInputValue("referralCode"));
    formData.append("password", document.getElementById("password").value);

    if (getInputValue("role") === "SELLER") {
      formData.append("dob", getInputValue("dob"));
      formData.append("idType", getInputValue("idType"));
      formData.append("idNumber", getInputValue("idNumber"));
      formData.append("shopName", getInputValue("shopName"));
      formData.append("shopLocation", getInputValue("shopLocation"));
      formData.append("proofOfOperation", getInputValue("proofOfOperation"));

      const idImage = document.getElementById("idImage").files[0];
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
        throw new Error(data.message || "Registration failed");
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