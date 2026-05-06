import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdminEconomySummary,
  getAdminFraudAlerts,
  getAdminTopCreators,
} from "../api/adminEconomy";
import { canAccessAdminFeatures } from "../utils/roles";
import { getStoredUser } from "../utils/storage";
import "../styles/admin-economy.css";

export default function AdminEconomy() {
  const navigate = useNavigate();
  const canAccess = useMemo(() => canAccessAdminFeatures(getStoredUser()), []);
  const [summary, setSummary] = useState(null);
  const [creators, setCreators] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    Promise.all([
      getAdminEconomySummary(),
      getAdminTopCreators(),
      getAdminFraudAlerts(),
    ])
      .then(([nextSummary, nextCreators, nextAlerts]) => {
        if (cancelled) return;
        setSummary(nextSummary || {});
        setCreators(Array.isArray(nextCreators) ? nextCreators : []);
        setAlerts(Array.isArray(nextAlerts) ? nextAlerts : []);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError?.response?.data?.error || "Could not load admin economy data.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canAccess]);

  if (!canAccess) {
    return (
      <main className="admin-economy-page">
        <section className="admin-economy-empty">
          <h1>Access denied</h1>
          <p>This page is available to admins, moderators, and senior developers only.</p>
          <button type="button" onClick={() => navigate(-1)}>Go back</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-economy-page">
      <header className="admin-economy-header">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>YKC Economy</h1>
          <p>Revenue-backed earnings and creator activity</p>
        </div>
      </header>

      {loading ? <div className="admin-economy-empty">Loading economy data...</div> : null}
      {error ? <div className="admin-economy-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <section className="admin-economy-grid">
            <MetricCard label="Total Revenue" value={formatMoney(summary?.totalRevenue)} />
            <MetricCard label="Reward Pool" value={formatMoney(summary?.rewardPool)} />
            <MetricCard label="Eligible YKC" value={formatNumber(summary?.totalEligibleYkc)} />
            <MetricCard label="YKC Value" value={formatMoney(summary?.ykcValue, 6)} />
            <MetricCard label="Qualified Views" value={formatNumber(summary?.totalQualifiedViews)} />
            <MetricCard label="Monetizable Opportunities" value={formatNumber(summary?.totalMonetizableOpportunities)} />
          </section>

          <section className="admin-economy-section">
            <div className="admin-economy-section__title">
              <h2>Top Creators</h2>
              <span>{creators.length} shown</span>
            </div>
            <div className="admin-economy-list">
              {creators.map((creator, index) => (
                <article className="admin-economy-row" key={creator.userId || creator._id || index}>
                  <strong>{index + 1}. {creator.username || "Creator"}</strong>
                  <span>{formatNumber(creator.totalQualifiedViews)} views</span>
                  <span>{formatDuration(creator.totalWatchTime)}</span>
                  <b>{formatNumber(creator.ykcEarnedThisMonth)} YKC</b>
                </article>
              ))}
              {!creators.length ? <p className="admin-economy-muted">No creator data yet.</p> : null}
            </div>
          </section>

          <section className="admin-economy-section">
            <div className="admin-economy-section__title">
              <h2>Fraud Alerts</h2>
              <span>{alerts.length} active</span>
            </div>
            <div className="admin-economy-list">
              {alerts.map((alert, index) => (
                <article className="admin-economy-row" key={alert._id || alert.userId || index}>
                  <strong>{alert.username || alert.userId || "Suspicious activity"}</strong>
                  <span>{alert.action || alert.reason || "Review activity"}</span>
                  <span>{formatNumber(alert.count || alert.watchDuration || 0)}</span>
                </article>
              ))}
              {!alerts.length ? <p className="admin-economy-muted">No active fraud alerts.</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="admin-economy-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatMoney(value, digits = 2) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatDuration(seconds) {
  const totalSeconds = Number(seconds || 0);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
