import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginRequest } from "../api/auth";
import { handleStaticImageError, staticImage } from "../utils/images";
import { saveAuth } from "../utils/storage";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginRequest(form);
      saveAuth(data?.token, data?.user);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout auth-layout--yenkasa">
      <div className="auth-stars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <section className="auth-panel auth-panel--login">
        <div className="auth-logo-wrap">
          <div className="auth-logo-emblem">
            <img
              src={staticImage("logo.png")}
              alt="Yenkasa"
              onError={(event) => handleStaticImageError(event, "logo.png")}
            />
          </div>
        </div>

        <section className="auth-card auth-card--yenkasa">
          <h1 className="auth-title">Welcome Back 👋</h1>
          <p className="auth-subtitle">Sign to see what&apos;s happening in your community</p>

          <form className="auth-form auth-form--yenkasa" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="sr-only">Email, phone, or username</span>
              <input
                value={form.identifier}
                onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
                placeholder="Email"
                required
              />
            </label>

            <label className="auth-field">
              <span className="sr-only">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Password"
                required
              />
            </label>

            <button className="forgot-link" type="button">
              Forgot password?
            </button>

            {error ? <div className="error-banner">{error}</div> : null}

            <button className="login-btn-gold" type="submit" disabled={loading}>
              {loading ? "SIGNING IN..." : "LOG IN"}
            </button>
          </form>

          <p className="auth-switch auth-switch--center">
            Don’t have an account? <Link to="/register">Sign Up</Link>
          </p>
        </section>
      </section>
    </main>
  );
}
