import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVerificationDashboard, getVerificationProgress } from "../api/verification";
import { formatNumber, readableRank } from "../utils/format";
import { getStoredUser } from "../utils/storage";
import "../styles/verification.css";

const RANK_TABS = ["verified", "rising_star", "legend"];

const METRIC_CARDS = [
  {
    key: "views",
    label: "Views",
    goalLabel: "Views tracked",
    icon: "◉",
    current: (metrics, performance) =>
      performance?.viewsReceived ??
      performance?.totalViewsReceived ??
      metrics?.totalViewsReceived ??
      0,
    goal: () => 0,
  },
  {
    key: "comments",
    label: "Comments",
    icon: "✎",
    current: (metrics) => metrics?.totalCommentsMade ?? 0,
    goal: (requirements) => requirements?.commentsMade ?? 0,
  },
  {
    key: "following",
    label: "Following",
    icon: "◎",
    current: (metrics) => metrics?.totalFollowing ?? 0,
    goal: (requirements) => requirements?.following ?? 0,
  },
  {
    key: "likes",
    label: "Likes Given",
    goalLabel: "Posts liked tracked",
    icon: "↗",
    current: (metrics) => metrics?.postsLiked ?? 0,
    goal: () => 0,
  },
];

export default function Verification() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [dashboard, setDashboard] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("verified");

  useEffect(() => {
    let alive = true;

    Promise.all([getVerificationDashboard(), getVerificationProgress()])
      .then(([dashboardData, progressData]) => {
        if (!alive) return;
        setDashboard(dashboardData);
        setProgress(progressData);
        const rankKey =
          dashboardData?.appVerification?.currentRank ||
          dashboardData?.appVerification?.currentRankKey ||
          dashboardData?.userRole ||
          storedUser?.roleName ||
          storedUser?.role?.role ||
          storedUser?.role;
        setSelectedTab(rankTabForRole(rankKey));
      })
      .catch((requestError) => {
        if (!alive) return;
        setError(
          requestError?.response?.data?.error ||
            "Verification dashboard could not be loaded."
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [storedUser]);

  const app = dashboard?.appVerification || {};
  const requirements = app.requirements || {};
  const metrics = app.currentMetrics || {};
  const performance = dashboard?.performanceMetrics || app.performanceMetrics || {};
  const currentRank = rankLabel(app.currentRank || app.currentRankKey);
  const nextRankKey = app.nextRank || app.nextRankKey;
  const nextRank = nextRankKey ? rankLabel(nextRankKey) : "Top Rank";
  const overallProgress =
    progress?.overallProgress ??
    app.progressToNextRank ??
    calculateOverallProgress(metrics, requirements);
  const currentPoints = currentRequirementPoints(metrics, requirements);
  const targetPoints = targetRequirementPoints(requirements);
  const remainingPoints = Math.max(0, targetPoints - currentPoints);
  const rankingCopy = buildRankingStatusText(app);
  const requirementRows = buildRequirementRows(metrics, requirements);
  const userName =
    storedUser?.username ||
    storedUser?.businessName ||
    storedUser?.fullName ||
    "Yenkasa";
  const avatarUrl =
    storedUser?.profilePicUrl ||
    storedUser?.profilePicture ||
    storedUser?.avatar ||
    storedUser?.photoUrl ||
    null;

  return (
    <main className="verification-page">
      <div className="verification-shell">
        <header className="verification-topbar">
          <button
            type="button"
            className="verification-topbar__icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
          <div className="verification-topbar__title">Verification &amp; Ranking</div>
          <button
            type="button"
            className="verification-topbar__icon"
            onClick={() =>
              window.alert(
                "Your rank is based on activity metrics. Higher tiers also require audience impact."
              )
            }
            aria-label="Ranking info"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 8h.01" />
            </svg>
          </button>
        </header>

        {loading ? (
          <section className="verification-summary">
            <div className="verification-summary__copy">Loading ranking dashboard...</div>
          </section>
        ) : null}

        {error ? (
          <section className="verification-summary">
            <div className="verification-summary__copy">{error}</div>
          </section>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="verification-hero">
              <div className="verification-hero__content">
                <div className="verification-hero__avatar">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={userName}
                      onError={(event) => {
                        event.currentTarget.src = "/images/default.png";
                      }}
                    />
                  ) : (
                    <img src="/images/ykc.png" alt="Yenkasa" />
                  )}
                </div>

                <div className="verification-hero__body">
                  <div className="verification-hero__name">
                    <h1>{userName}</h1>
                    <span className="verification-hero__check">✓</span>
                  </div>
                  <div className="verification-hero__chip">{currentRank}</div>
                  <p className="verification-hero__subcopy">{rankingCopy}</p>
                </div>

                <RankShield rank={app.currentRank || app.currentRankKey} />
              </div>
            </section>

            <section className="verification-tabs">
              {RANK_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`verification-tabs__tab${
                    selectedTab === tab ? " verification-tabs__tab--active" : ""
                  }`}
                  onClick={() => setSelectedTab(tab)}
                >
                  {rankLabel(tab)}
                </button>
              ))}
            </section>

            <section className="verification-summary">
              <div className="verification-summary__grid">
                <div>
                  <div className="verification-summary__label">Your Current Rank</div>
                  <div className="verification-summary__rank">{currentRank}</div>
                  <div className="verification-summary__copy">
                    Keep going. You&apos;re making strong progress through the Yenkasa
                    ranking system.
                  </div>
                </div>

                <ProgressRing value={overallProgress} />

                <div>
                  <div className="verification-summary__label">Next Rank</div>
                  <div className="verification-summary__next">{nextRank}</div>
                  <div className="verification-summary__copy">
                    Reach the next milestone to unlock more platform power.
                  </div>
                </div>
              </div>

              <div className="verification-summary__progress-line">
                <div className="verification-summary__points">
                  <span>
                    {formatNumber(currentPoints)} / {formatNumber(targetPoints)} points
                  </span>
                  <span>{overallProgress}%</span>
                </div>
                <div className="verification-progress-track">
                  <div
                    className="verification-progress-fill"
                    style={{ width: `${clampPercent(overallProgress)}%` }}
                  />
                </div>
                <div className="verification-summary__points-sub">
                  {formatNumber(remainingPoints)} points to {nextRank}
                </div>
              </div>
            </section>

            <section>
              <div className="verification-section-title">Your Metrics</div>
              <div className="verification-metrics-grid">
                {METRIC_CARDS.map((card) => {
                  const current = card.current(metrics, performance);
                  const goal = card.goal(requirements, metrics, performance);
                  const label =
                    goal > 0 ? `Goal: ${formatNumber(goal)}` : card.goalLabel;
                  return (
                    <MetricCard
                      key={card.key}
                      icon={card.icon}
                      label={card.label}
                      value={current}
                      goalLabel={label}
                      progress={goal > 0 ? calculatePercent(current, goal) : current > 0 ? 100 : 0}
                    />
                  );
                })}
              </div>
            </section>

            <section>
              <div className="verification-section-title">
                <span>To reach {nextRank}</span>
                <button
                  type="button"
                  className="verification-link-pill"
                  onClick={() =>
                    window.alert(
                      "Ranks grow from activity first. Higher tiers also require audience impact."
                    )
                  }
                >
                  View all ranks
                </button>
              </div>

              <div className="verification-requirements">
                {requirementRows.map((row) => {
                  const remaining = Math.max(0, row.target - row.current);
                  return (
                    <div className="verification-requirement" key={row.key}>
                      <div className="verification-requirement__dot">{row.icon}</div>
                      <div>
                        <div className="verification-requirement__title">{row.title}</div>
                        <div className="verification-requirement__helper">{row.helper}</div>
                        <div className="verification-requirement__track">
                          <span
                            style={{ width: `${calculatePercent(row.current, row.target)}%` }}
                          />
                        </div>
                      </div>
                      <div className="verification-requirement__count">
                        {formatNumber(row.current)} / {formatNumber(row.target)}
                      </div>
                      <div className="verification-requirement__badge">
                        {remaining === 0
                          ? "Done"
                          : `${formatNumber(remaining)} ${row.remainingLabel}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="verification-footer-card">
              <div className="verification-footer-card__copy">
                <strong>You&apos;re doing great!</strong>
                <p>Keep engaging to unlock higher ranks and more Yenkasa benefits.</p>
              </div>
              <button
                type="button"
                className="verification-footer-card__button"
                onClick={() => navigate("/menu")}
              >
                Learn More
              </button>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function ProgressRing({ value }) {
  const safeValue = clampPercent(value);
  return (
    <div className="verification-ring" style={{ "--progress": safeValue }}>
      <div className="verification-ring__inner">
        <div className="verification-ring__value">{safeValue}%</div>
        <div className="verification-ring__label">Progress</div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, goalLabel, progress }) {
  return (
    <article className="verification-metric-card">
      <div className="verification-metric-card__icon">{icon}</div>
      <div className="verification-metric-card__value">{formatNumber(value)}</div>
      <div className="verification-metric-card__label">{label}</div>
      <div className="verification-metric-card__goal">{goalLabel}</div>
      <div className="verification-metric-card__bar">
        <span style={{ width: `${clampPercent(progress)}%` }} />
      </div>
    </article>
  );
}

function RankShield({ rank }) {
  const label = rankLabel(rank).toUpperCase();
  const rankClass = String(rank || "verified").toLowerCase();

  return (
    <div className={`verification-shield verification-shield--${rankClass}`}>
      <div className="verification-shield__glow" />
      <div className="verification-shield__body">
        <img src="/images/ykc.png" alt="Yenkasa badge" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function rankLabel(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();

  switch (normalized) {
    case "verified":
      return "Verified";
    case "rising_star":
      return "Rising Star";
    case "legend":
      return "Legend";
    case "admin":
      return "Admin";
    case "moderator":
      return "Moderator";
    case "junior_developer":
      return "Junior Developer";
    case "senior_developer":
      return "Senior Developer";
    default:
      return readableRank(normalized || "unverified");
  }
}

function rankTabForRole(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();
  if (normalized === "rising_star") return "rising_star";
  if (
    normalized === "legend" ||
    normalized === "admin" ||
    normalized === "moderator" ||
    normalized === "junior_developer" ||
    normalized === "senior_developer"
  ) {
    return "legend";
  }
  return "verified";
}

function buildRankingStatusText(app) {
  if (app?.rankingPeriodStatus === "pre_launch") {
    return `Pre-launch ranking period. Official Phase 1 begins on ${formatLaunchDate(
      app?.officialPhaseStartDate || app?.rankingLaunchDate
    )}. You can still earn ranks now.`;
  }

  if (app?.rankingPeriodStatus === "active_phase") {
    return "Phase 1 is active. Complete targets within the phase period.";
  }

  return buildMemberSinceText(app?.rankingPeriodLabel, app?.phaseStartDate);
}

function buildMemberSinceText(periodLabel, raw) {
  const memberSince = formatMemberSince(raw);
  return periodLabel ? `${periodLabel} • ${memberSince}` : memberSince;
}

function formatMemberSince(raw) {
  if (!raw) return "Member since your first login";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Member since your first login";
  return `Member since ${date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })}`;
}

function formatLaunchDate(raw) {
  if (!raw) return "25 May 2026";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "25 May 2026";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calculateOverallProgress(metrics, requirements) {
  const values = [
    calculatePercent(metrics?.accountAge, requirements?.accountAge),
    calculatePercent(metrics?.totalCommentsMade, requirements?.commentsMade),
    calculatePercent(metrics?.totalFollowing, requirements?.following),
    calculatePercent(metrics?.postsLiked, requirements?.likesGiven),
    calculatePercent(metrics?.dailyLogins, requirements?.dailyLogins),
    calculatePercent(metrics?.adsViewed, requirements?.adsViewed),
  ];

  if ((requirements?.followers || 0) > 0) {
    values.push(calculatePercent(metrics?.totalFollowers, requirements?.followers));
  }
  if ((requirements?.commentsReceived || 0) > 0) {
    values.push(
      calculatePercent(
        metrics?.totalCommentsReceived,
        requirements?.commentsReceived
      )
    );
  }

  return clampPercent(Math.round(values.reduce((sum, item) => sum + item, 0) / values.length));
}

function currentRequirementPoints(metrics, requirements) {
  return [
    [metrics?.accountAge, requirements?.accountAge],
    [metrics?.totalCommentsMade, requirements?.commentsMade],
    [metrics?.totalFollowing, requirements?.following],
    [metrics?.postsLiked, requirements?.likesGiven],
    [metrics?.dailyLogins, requirements?.dailyLogins],
    [metrics?.adsViewed, requirements?.adsViewed],
    [metrics?.totalFollowers, requirements?.followers],
    [metrics?.totalCommentsReceived, requirements?.commentsReceived],
  ]
    .filter(([, target]) => Number(target || 0) > 0)
    .reduce(
      (sum, [current, target]) => sum + Math.min(Number(current || 0), Number(target || 0)),
      0
    );
}

function targetRequirementPoints(requirements) {
  return [
    requirements?.accountAge,
    requirements?.commentsMade,
    requirements?.following,
    requirements?.likesGiven,
    requirements?.dailyLogins,
    requirements?.adsViewed,
    requirements?.followers,
    requirements?.commentsReceived,
  ].reduce((sum, value) => sum + Number(value || 0), 0);
}

function buildRequirementRows(metrics, requirements) {
  const rows = [
    {
      key: "account-age",
      title: "Account Age",
      helper: "Keep your account active",
      current: Number(metrics?.accountAge || 0),
      target: Number(requirements?.accountAge || 0),
      remainingLabel: "days",
      icon: "◉",
    },
    {
      key: "comments-made",
      title: "Comments Made",
      helper: "Engage on posts",
      current: Number(metrics?.totalCommentsMade || 0),
      target: Number(requirements?.commentsMade || 0),
      remainingLabel: "left",
      icon: "✎",
    },
    {
      key: "following",
      title: "Following",
      helper: "Support other users",
      current: Number(metrics?.totalFollowing || 0),
      target: Number(requirements?.following || 0),
      remainingLabel: "left",
      icon: "◎",
    },
    {
      key: "likes-given",
      title: "Posts Liked",
      helper: "Support posts you enjoy",
      current: Number(metrics?.postsLiked || 0),
      target: Number(requirements?.likesGiven || 0),
      remainingLabel: "left",
      icon: "↗",
    },
    {
      key: "daily-logins",
      title: "Daily Logins",
      helper: "Return daily and stay active",
      current: Number(metrics?.dailyLogins || 0),
      target: Number(requirements?.dailyLogins || 0),
      remainingLabel: "left",
      icon: "◌",
    },
    {
      key: "ads-viewed",
      title: "Ads Viewed",
      helper: "Watch rewarded ads",
      current: Number(metrics?.adsViewed || 0),
      target: Number(requirements?.adsViewed || 0),
      remainingLabel: "left",
      icon: "▣",
    },
  ];

  if (Number(requirements?.followers || 0) > 0) {
    rows.push({
      key: "followers",
      title: "Followers",
      helper: "Passive impact needed for this tier",
      current: Number(metrics?.totalFollowers || 0),
      target: Number(requirements?.followers || 0),
      remainingLabel: "left",
      icon: "◍",
    });
  }

  if (Number(requirements?.commentsReceived || 0) > 0) {
    rows.push({
      key: "comments-received",
      title: "Comments Received",
      helper: "Your content must attract replies",
      current: Number(metrics?.totalCommentsReceived || 0),
      target: Number(requirements?.commentsReceived || 0),
      remainingLabel: "left",
      icon: "◈",
    });
  }

  return rows.filter((row) => row.target > 0);
}

function calculatePercent(current, target) {
  const goal = Number(target || 0);
  if (goal <= 0) return 0;
  return clampPercent(Math.round((Number(current || 0) / goal) * 100));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}
