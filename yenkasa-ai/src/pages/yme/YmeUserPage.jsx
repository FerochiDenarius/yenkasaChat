import { useMemo } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { ArrowRight, BrainCircuit, Sparkles, Users } from "lucide-react";
import { YmeBadge, YmeCard, YmeCardHeader, YmeEmptyState, YmeMetricCard, YmeProgressRow } from "../../components/yme/YmePrimitives";
import { useYmeInspector } from "../../services/yme/useYmeInspector";
import { clamp, formatCount, formatDate, formatDuration, formatPercent, safeArray } from "../../services/yme/ymeHelpers";

export default function YmeUserPage() {
  const { refreshSignal } = useOutletContext() || {};
  const { userId } = useParams();
  const { data, loading, error } = useYmeInspector({ userId, limit: 40, refreshSignal });

  const overview = data || {};
  const user = overview.user || {};
  const profile = overview.profile || {};
  const interestProfile = overview.interestProfile || overview.userInspection?.interestProfile || {};
  const retrievalQuality = overview.retrievalQuality || overview.userInspection?.retrievalQuality || {};
  const signalCalibration = overview.signalCalibration || {};
  const events = safeArray(overview.recentEvents);
  const creatorAffinities = safeArray(overview.profileArtifacts?.creatorAffinities);

  const topInterests = useMemo(() => safeArray(interestProfile.topInterests).slice(0, 8), [interestProfile.topInterests]);

  const metricCards = [
    { label: "Memories", value: formatCount(profile.memorySummaries?.length || 0), note: "Rolling summaries", icon: BrainCircuit, tone: "purple" },
    { label: "Events", value: formatCount(events.length), note: "Recent sample", icon: Users, tone: "cyan" },
    { label: "Signals", value: formatCount(signalCalibration.strongestSignals?.length || 0), note: "Strongest signals", icon: Sparkles, tone: "green" },
    { label: "Retrieval quality", value: formatPercent(retrievalQuality.retrievalQualityScore || 0), note: "Query ranking health", icon: Sparkles, tone: "amber" },
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">User memory profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">@{user.username || userId}</h1>
          <p className="mt-2 text-sm text-slate-400">Search, inspect, and verify how the memory engine represents this user.</p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-violet-200">
          Back to overview <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <YmeMetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <YmeCard className="p-5" strong>
          <YmeCardHeader title="User profile" subtitle="Core memory and identity details." />
          <div className="mt-4 flex gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03]">
              <img
                src={user.profileImage || "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"}
                alt={user.username || "User avatar"}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <YmeBadge tone={user.online ? "good" : "neutral"}>{user.online ? "Online" : "Offline"}</YmeBadge>
                {user.verified ? <YmeBadge tone="good">Verified</YmeBadge> : <YmeBadge>Unverified</YmeBadge>}
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p>Joined: {formatDate(profile.createdAt || user.createdAt)}</p>
                <p>Last seen: {formatDate(user.lastSeen || user.lastLoginAt)}</p>
                <p>Role: {user.accessRole || user.roleName || "user"}</p>
                <p>Wallet: {user.walletId || "—"}</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                This card is read-only. The goal is to make the memory system observable, not to modify ranking or recommendational behavior.
              </p>
            </div>
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Engagement style" subtitle="How this user tends to interact with content and communities." />
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Primary mode</p>
                <p className="mt-3 text-lg font-semibold text-white">{interestProfile.engagementStyle?.primaryMode || "balanced"}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Watch bias</p>
                <p className="mt-3 text-lg font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.watchBias || 0)}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Social bias</p>
                <p className="mt-3 text-lg font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.socialBias || 0)}</p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Creator bias</p>
                <p className="mt-3 text-lg font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.creatorBias || 0)}</p>
              </div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Active hours</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {safeArray(interestProfile.activeHours).slice(0, 10).map((entry) => (
                  <YmeBadge key={entry.hour} tone="purple">
                    {String(entry.hour).padStart(2, "0")}:00 - {formatPercent(entry.score || 0)}
                  </YmeBadge>
                ))}
              </div>
            </div>
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Top interests" subtitle="Affinity distribution derived from watch behavior, topics, and social graph signals." />
          <div className="mt-4 space-y-3">
            {topInterests.length ? topInterests.map((item) => (
              <YmeProgressRow
                key={item.label}
                label={item.label}
                value={formatPercent(item.score || 0)}
                percent={clamp(item.score || 0, 0, 1) * 100}
              />
            )) : <YmeEmptyState title="No stable interests yet" description="The current profile sample does not contain enough recurring topic signals." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Creator affinity" subtitle="Who this user consistently interacts with." />
          <div className="mt-4 space-y-3">
            {creatorAffinities.length ? creatorAffinities.slice(0, 5).map((item, index) => (
              <YmeProgressRow
                key={item.creatorId || index}
                label={item.creatorUsername || item.creatorId || `Creator ${index + 1}`}
                value={formatPercent(item.affinityScore || 0)}
                percent={clamp(item.affinityScore || 0, 0, 1) * 100}
                tone={index % 2 ? "cyan" : "violet"}
              />
            )) : <YmeEmptyState title="No creator affinity" description="Not enough creator interaction has been observed in this sample." />}
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Recent events" subtitle="Most recent user behavior flowing into the memory engine." />
          <div className="mt-4 space-y-3">
            {events.length ? events.slice(0, 8).map((event) => (
              <div key={event._id || event.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{event.eventType || "event"}</p>
                  <p className="text-xs text-slate-500">{formatDate(event.occurredAt || event.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-400">{event.summary || event.normalizedText || event.description || "No summary available."}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Signal {formatPercent(event.signalStrengthScore || 0)} · Importance {formatPercent(event.importanceScore || 0)}
                </p>
              </div>
            )) : <YmeEmptyState title="No recent events" description="This user profile has no recent event sample available." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Retrieval quality" subtitle="How useful the retrieved memories are for this user." />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Score</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatPercent(retrievalQuality.retrievalQualityScore || 0)}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Latency</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatDuration(retrievalQuality.retrievalLatencyMs || 0)}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Duplicates</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatCount(retrievalQuality.duplicateRetrievalCount || 0)}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Low quality</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatCount(retrievalQuality.lowQualityRetrievalCount || 0)}</p>
            </div>
          </div>
        </YmeCard>
      </div>

      {error ? <YmeCard className="border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">Failed to load user profile: {error}</YmeCard> : null}
      {loading ? <YmeCard className="p-4 text-sm text-slate-300">Loading user memory profile...</YmeCard> : null}
    </div>
  );
}
