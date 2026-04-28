import { useEffect, useState } from "react";
import { getVerificationDashboard, getVerificationProgress } from "../api/verification";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import ProgressBar from "../components/ProgressBar";
import { formatNumber, readableRank } from "../utils/format";

export default function Verification() {
  const [dashboard, setDashboard] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getVerificationDashboard(), getVerificationProgress()])
      .then(([dashboardData, progressData]) => {
        setDashboard(dashboardData);
        setProgress(progressData);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Verification dashboard could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  const appVerification = dashboard?.appVerification;
  const requirements = appVerification?.requirements || {};
  const metrics = appVerification?.currentMetrics || {};
  const progressValue = progress?.overallProgress ?? appVerification?.progressToNextRank ?? 0;

  return (
    <main className="page page--with-nav">
      <PageHeader
        eyebrow="Ranking"
        title="Verification Dashboard"
        subtitle="Track your Yenkasa activity rank and progress."
      />

      {loading ? <div className="card shimmer-block">Loading ranking dashboard...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {appVerification ? (
        <>
          <section className="card stack">
            <div className="split-row">
              <div>
                <span className="muted">Current rank</span>
                <h2>{readableRank(appVerification.currentRank || appVerification.currentRankKey)}</h2>
              </div>
              <span className="tag">{readableRank(appVerification.nextRank || appVerification.nextRankKey || "top_rank")}</span>
            </div>
            <p className="muted">
              {appVerification.rankingPeriodStatus === "pre_launch"
                ? `Pre-launch ranking period. Official Phase 1 begins on ${new Date(appVerification.officialPhaseStartDate).toLocaleDateString()}. You can still earn ranks now.`
                : "Phase 1 is active. Complete targets within the phase period."}
            </p>
            <ProgressBar value={progressValue} label="Progress to next rank" />
          </section>

          <section className="grid-two">
            <MetricCard label="Current Phase" value={appVerification.currentPhase ?? "Pre-launch"} />
            <MetricCard label="Ranking Status" value={appVerification.rankingPeriodStatus || "unknown"} />
          </section>

          <section className="card stack">
            <h3>Requirements</h3>
            <div className="metric-list">
              <MetricRow label="Account Age" current={metrics.accountAge} target={requirements.accountAge} />
              <MetricRow label="Comments Made" current={metrics.totalCommentsMade} target={requirements.commentsMade || requirements.comments} />
              <MetricRow label="Following" current={metrics.totalFollowing} target={requirements.following || requirements.followers} />
              <MetricRow label="Likes Given" current={metrics.postsLiked} target={requirements.likesGiven || requirements.maxLikes} />
              <MetricRow label="Daily Logins" current={metrics.dailyLogins} target={requirements.dailyLogins} />
              <MetricRow label="Ads Viewed" current={metrics.adsViewed} target={requirements.adsViewed} />
              {(requirements.followers || 0) > 0 ? (
                <MetricRow label="Followers" current={metrics.totalFollowers} target={requirements.followers} />
              ) : null}
              {(requirements.commentsReceived || 0) > 0 ? (
                <MetricRow label="Comments Received" current={metrics.totalCommentsReceived} target={requirements.commentsReceived} />
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricRow({ label, current, target }) {
  const safeCurrent = Number(current || 0);
  const safeTarget = Number(target || 0);
  const progress = safeTarget > 0 ? Math.min(100, Math.round((safeCurrent / safeTarget) * 100)) : 0;

  return (
    <div className="metric-row">
      <div className="split-row">
        <span>{label}</span>
        <strong>
          {formatNumber(safeCurrent)} / {formatNumber(safeTarget)}
        </strong>
      </div>
      <ProgressBar value={progress} />
    </div>
  );
}
