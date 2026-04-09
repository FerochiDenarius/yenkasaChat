document.getElementById("sellerLoginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/users/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      }
    );

    const user = await response.json();

    if (!response.ok) {
      throw new Error(user.message || user.error || "Login failed");
    }

    if (!user.user || !user.token) {
      throw new Error(user.message || "Login failed");
    }

    if (user.user.role !== "SELLER") {
      alert("This login is only for sellers.");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("authToken");
      return;
    }

    localStorage.removeItem("loggedIn");
    localStorage.setItem("currentUser", JSON.stringify(user.user));
    localStorage.setItem("authToken", user.token);
    window.location.href = "seller-dashboard.html";
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
