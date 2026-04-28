import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getProfile } from "../api/profile";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import { useAsync } from "../hooks/useAsync";
import { clearAuth, getStoredUser } from "../utils/storage";
import { readableRank } from "../utils/format";

export default function Profile() {
  const storedUser = getStoredUser();
  const { data, loading, error } = useAsync(getProfile, true);
  const user = useMemo(() => data || storedUser || {}, [data, storedUser]);

  return (
    <main className="page page--with-nav">
      <PageHeader
        eyebrow="Account"
        title={user?.username || "Profile"}
        subtitle="Your personal Yenkasa space."
        actionLabel="Verification"
        actionTo="/verification"
      />

      {error ? <div className="error-banner">Profile could not be loaded.</div> : null}

      <section className="card profile-card">
        <div className="profile-card__top">
          <div>
            <h2>{user?.username || "Unknown user"}</h2>
            <p>{user?.email || user?.phoneNumber || "No contact info yet"}</p>
          </div>
          <span className="tag">{readableRank(user?.roleName)}</span>
        </div>
        <p>{loading ? "Loading profile..." : user?.bio || "No bio added yet."}</p>
      </section>

      <section className="grid-two">
        <MetricCard label="Followers" value={user?.followers?.length || 0} />
        <MetricCard label="Following" value={user?.following?.length || 0} />
      </section>

      <section className="card stack">
        <Link className="ghost-link" to="/verification">
          Open Verification Dashboard
        </Link>
        <button
          className="secondary-btn"
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </section>
    </main>
  );
}
