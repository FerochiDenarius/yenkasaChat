import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerRequest } from "../api/auth";
import { getCommunities } from "../api/communities";

export default function Register() {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    phoneNumber: "",
    location: "",
    password: "",
    country: "Ghana",
    communityId: ""
  });

  useEffect(() => {
    getCommunities()
      .then((data) => setCommunities(Array.isArray(data) ? data : []))
      .catch(() => setCommunities([]))
      .finally(() => setLoadingCommunities(false));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...form,
        communityId: form.communityId,
        communityIds: form.communityId ? [form.communityId] : []
      };
      const response = await registerRequest(payload);
      setMessage(response?.message || "Registration successful. Please sign in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card auth-card--wide">
        <span className="page-header__eyebrow">Create Yenkasa account</span>
        <h1>Join the network</h1>
        <p>Build your feed, grow communities, and start your activity-based ranking journey.</p>

        <form className="auth-form auth-form--grid" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>
          <label>
            Phone
            <input
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
            />
          </label>
          <label>
            Location
            <input
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              required
            />
          </label>
          <label>
            Country
            <select
              value={form.country}
              onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
            >
              <option value="Ghana">Ghana</option>
              <option value="Nigeria">Nigeria</option>
            </select>
          </label>
          <label>
            Community
            <select
              value={form.communityId}
              onChange={(e) => setForm((prev) => ({ ...prev, communityId: e.target.value }))}
              required
              disabled={loadingCommunities}
            >
              <option value="">{loadingCommunities ? "Loading..." : "Select a community"}</option>
              {communities.map((community) => (
                <option key={community._id} value={community._id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-form__full">
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          {error ? <div className="error-banner auth-form__full">{error}</div> : null}
          {message ? <div className="success-banner auth-form__full">{message}</div> : null}
          <button className="primary-btn auth-form__full" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
