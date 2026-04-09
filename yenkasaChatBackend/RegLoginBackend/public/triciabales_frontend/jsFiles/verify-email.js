const verifyContainer = document.getElementById("verifyEmailStatus");
const token = new URLSearchParams(window.location.search).get("token");

async function verifyEmail() {
  if (!token) {
    verifyContainer.innerHTML = `
      <h2>Verification Link Missing</h2>
      <p>This email verification link is incomplete.</p>
      <p><a href="buyer-login.html" class="primary-btn">Go to Login</a></p>
    `;
    return;
  }

  try {
    const response = await fetch(
      `/triciabales-api/api/users/verify-email?token=${encodeURIComponent(token)}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Verification failed");
    }

    verifyContainer.innerHTML = `
      <h2>Email Verified</h2>
      <p>${data.message || "Your email has been verified successfully."}</p>
      <p><a href="buyer-login.html" class="primary-btn">Login Now</a></p>
    `;
  } catch (err) {
    verifyContainer.innerHTML = `
      <h2>Verification Failed</h2>
      <p>${err.message}</p>
      <p><a href="buyer-login.html" class="primary-btn">Go to Login</a></p>
    `;
  }
}

verifyEmail();
