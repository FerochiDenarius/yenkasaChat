import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVerificationDashboard, getVerificationProgress } from "../api/verification";
import { formatNumber, readableRank } from "../utils/format";
import { getStoredUser } from "../utils/storage";
import {
  handleDynamicImageError,
  handleStaticImageError,
  staticImage,
} from "../utils/images";
import "../styles/verification.css";

const RANK_TABS = ["verified", "admin", "moderator"];

const METRIC_CARDS = [
  {
    key: "views",
    label: "Views",
    goalLabel: "Views tracked",
    icon: "eye",
    current: (metrics, performance) =>
      performance?.viewsReceived ??
      performance?.totalViewsReceived ??
      metrics?.totalViewsReceived ??
      0,
    goal: (requirements) =>
      requirements?.views ??
      requirements?.viewsReceived ??
      requirements?.totalViewsReceived ??
      0,
  },
  {
    key: "comments",
    label: "Comments",
    icon: "pencil",
    current: (metrics) => metrics?.totalCommentsMade ?? 0,
    goal: (requirements) => requirements?.commentsMade ?? 0,
  },
  {
    key: "followers",
    label: "Followers",
    icon: "users",
    current: (metrics) => metrics?.totalFollowers ?? metrics?.followers ?? 0,
    goal: (requirements) => requirements?.followers ?? 0,
  },
  {
    key: "shares",
    label: "Shares",
    icon: "share",
    current: (metrics, performance) =>
      metrics?.totalShares ??
      metrics?.shares ??
      performance?.totalShares ??
      performance?.shares ??
      0,
    goal: (requirements) => requirements?.shares ?? requirements?.postsShared ?? 0,
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
                      onError={handleDynamicImageError}
                    />
                  ) : (
                    <img
                      src={staticImage("logo.png")}
                      alt="Yenkasa"
                      onError={(event) => handleStaticImageError(event, "logo.png")}
                    />
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
                  <Icon name={rankIcon(tab)} />
                  <span>{rankTabLabel(tab)}</span>
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
                      <div className="verification-requirement__dot">
                        <Icon name={row.icon} />
                      </div>
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
              <div className="verification-footer-card__icon">
                <Icon name="crown" />
              </div>
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
      <div className="verification-metric-card__icon">
        <Icon name={icon} />
      </div>
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
  const rankClass = String(rank || "verified").toLowerCase();
  const emblem = rankEmblem(rank);

  return (
    <div className={`verification-shield verification-shield--${rankClass}`}>
      <div className="verification-shield__glow" />
      <div className="verification-shield__body">
        <img
          src={staticImage(emblem)}
          alt={`${rankLabel(rank)} badge`}
          onError={(event) => handleStaticImageError(event, emblem)}
        />
      </div>
    </div>
  );
}

function rankEmblem(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();

  switch (normalized) {
    case "admin":
      return "admin.png";
    case "moderator":
      return "moderator.png";
    case "junior_developer":
      return "junior_developer_banner.png";
    case "senior_developer":
      return "senior_developer_banner.png";
    case "verified":
    case "rising_star":
    case "legend":
    default:
      return "verified.png";
  }
}

function rankLabel(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();

  switch (normalized) {
    case "verified":
      return "Verified Member";
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

function rankTabLabel(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();
  if (normalized === "verified") return "Verified";
  return rankLabel(normalized);
}

function rankIcon(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();
  if (normalized === "admin") return "crown";
  if (normalized === "moderator") return "shield";
  return "verified";
}

function rankTabForRole(rankKey) {
  const normalized = String(rankKey || "").trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "moderator") return "moderator";
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
    calculatePercent(
      metrics?.totalViewsReceived,
      requirements?.views ?? requirements?.viewsReceived ?? requirements?.totalViewsReceived
    ),
    calculatePercent(metrics?.totalCommentsMade, requirements?.commentsMade),
    calculatePercent(metrics?.totalFollowers ?? metrics?.followers, requirements?.followers),
    calculatePercent(
      metrics?.totalShares ?? metrics?.shares,
      requirements?.shares ?? requirements?.postsShared
    ),
    calculatePercent(metrics?.dailyLogins, requirements?.dailyLogins),
    calculatePercent(metrics?.adsViewed, requirements?.adsViewed),
  ];

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
    [
      metrics?.totalViewsReceived,
      requirements?.views ?? requirements?.viewsReceived ?? requirements?.totalViewsReceived,
    ],
    [metrics?.totalCommentsMade, requirements?.commentsMade],
    [metrics?.totalFollowers ?? metrics?.followers, requirements?.followers],
    [metrics?.totalShares ?? metrics?.shares, requirements?.shares ?? requirements?.postsShared],
    [metrics?.dailyLogins, requirements?.dailyLogins],
    [metrics?.adsViewed, requirements?.adsViewed],
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
    requirements?.views ?? requirements?.viewsReceived ?? requirements?.totalViewsReceived,
    requirements?.commentsMade,
    requirements?.followers,
    requirements?.shares ?? requirements?.postsShared,
    requirements?.dailyLogins,
    requirements?.adsViewed,
    requirements?.commentsReceived,
  ].reduce((sum, value) => sum + Number(value || 0), 0);
}

function buildRequirementRows(metrics, requirements) {
  const rows = [
    {
      key: "views",
      title: "Views",
      helper: "Get more views on your posts",
      current: Number(metrics?.totalViewsReceived || 0),
      target: Number(
        requirements?.views ||
          requirements?.viewsReceived ||
          requirements?.totalViewsReceived ||
          0
      ),
      remainingLabel: "left",
      icon: "eye",
    },
    {
      key: "comments-made",
      title: "Comments Made",
      helper: "Engage on posts",
      current: Number(metrics?.totalCommentsMade || 0),
      target: Number(requirements?.commentsMade || 0),
      remainingLabel: "left",
      icon: "pencil",
    },
    {
      key: "followers",
      title: "Followers",
      helper: "Grow your followers",
      current: Number(metrics?.totalFollowers || metrics?.followers || 0),
      target: Number(requirements?.followers || 0),
      remainingLabel: "left",
      icon: "users",
    },
    {
      key: "shares",
      title: "Shares",
      helper: "Share your content",
      current: Number(metrics?.totalShares || metrics?.shares || 0),
      target: Number(requirements?.shares || requirements?.postsShared || 0),
      remainingLabel: "left",
      icon: "share",
    },
    {
      key: "daily-logins",
      title: "Daily Logins",
      helper: "Return daily and stay active",
      current: Number(metrics?.dailyLogins || 0),
      target: Number(requirements?.dailyLogins || 0),
      remainingLabel: "left",
      icon: "verified",
    },
    {
      key: "ads-viewed",
      title: "Ads Viewed",
      helper: "Watch rewarded ads",
      current: Number(metrics?.adsViewed || 0),
      target: Number(requirements?.adsViewed || 0),
      remainingLabel: "left",
      icon: "eye",
    },
  ];

  if (Number(requirements?.commentsReceived || 0) > 0) {
    rows.push({
      key: "comments-received",
      title: "Comments Received",
      helper: "Your content must attract replies",
      current: Number(metrics?.totalCommentsReceived || 0),
      target: Number(requirements?.commentsReceived || 0),
      remainingLabel: "left",
      icon: "pencil",
    });
  }

  return rows.filter((row) => row.target > 0);
}

function Icon({ name }) {
  switch (name) {
    case "crown":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z" />
          <path d="M5 21h14" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z" />
          <path d="m9 12 2 2 4-5" />
        </svg>
      );
    case "pencil":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
          <path d="m13 7 4 4" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 11a4 4 0 1 0-8 0" />
          <path d="M4 20c1.2-3 4-5 8-5s6.8 2 8 5" />
          <path d="M18 8a3 3 0 0 1 2 5" />
          <path d="M6 8a3 3 0 0 0-2 5" />
        </svg>
      );
    case "share":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.7 10.7 6.6-4.4" />
          <path d="m8.7 13.3 6.6 4.4" />
        </svg>
      );
    case "eye":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "verified":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2L15.8 9" />
        </svg>
      );
  }
}

function calculatePercent(current, target) {
  const goal = Number(target || 0);
  if (goal <= 0) return 0;
  return clampPercent(Math.round((Number(current || 0) / goal) * 100));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}
