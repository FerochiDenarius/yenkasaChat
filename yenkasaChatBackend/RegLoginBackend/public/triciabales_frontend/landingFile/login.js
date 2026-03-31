function login() {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password");
    return;
  }

  const data = { email, password };

  console.log("Sending request...", data);

fetch("http://134.209.182.39:8080/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    console.log("Response received", res);
    return res.json();
  })
  .then(res => {

    console.log("Response JSON:", res);

    if (res.success === true) {
      localStorage.setItem("loggedIn", "true");
      alert("Login successful");
      window.location.href = "admin.html";
    } else {
      alert("Invalid email or password");
    }

  })
  .catch(err => {
    console.error("Fetch error:", err);
    alert("Login failed - check backend");
  });
}