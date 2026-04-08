document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    role: document.getElementById("role").value,
    referralCode: document.getElementById("referralCode").value.trim() || null,
    password: document.getElementById("password").value
  };

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/users/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Registration failed");
    }

    if (data.role === "SELLER" || data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
      localStorage.removeItem("currentUser");
      alert("Account created successfully. Please log in to continue.");
      window.location.href = "buyer-login.html";
    } else {
      localStorage.setItem("currentUser", JSON.stringify(data));
      alert("Account created successfully!");
      window.location.href = "index.html";
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
