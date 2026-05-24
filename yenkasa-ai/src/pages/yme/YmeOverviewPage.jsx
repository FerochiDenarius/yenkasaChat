import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BrainCircuit,
  Clock3,
  Database,
  Flame,
  Gauge,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { YmeBadge, YmeCard, YmeCardHeader, YmeEmptyState, YmeList, YmeMetricCard, YmeProgressRow } from "../../components/yme/YmePrimitives";
import { useYmeInspector } from "../../services/yme/useYmeInspector";
import {
  clamp,
  createHourlyHeatmap,
  formatCount,
  formatDate,
  formatDuration,
  formatPercent,
  safeArray,
  summarizeByDay,
  summarizeByType,
} from "../../services/yme/ymeHelpers";

const PIE_COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#38bdf8", "#ec4899", "#f97316"];

function percent(value) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function YmeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[18px] border border-white/10 bg-[#090b12] px-4 py-3 text-xs text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <p className="font-semibold text-white">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p key={entry.dataKey} className="text-slate-300">
            {entry.name || entry.dataKey}: <span className="font-semibold text-white">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function SectionMetric({ label, value, note }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      {note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}

export default function YmeOverviewPage() {
  const { refreshSignal } = useOutletContext() || {};
  const { data, loading, error } = useYmeInspector({ limit: 45, refreshSignal });

  const overview = data || {};
  const system = overview.system || {};
  const profile = overview.profile || {};
  const user = overview.user || {};
  const interestProfile = overview.interestProfile || overview.userInspection?.interestProfile || {};
  const retrievalQuality = overview.retrievalQuality || overview.userInspection?.retrievalQuality || {};
  const signalCalibration = overview.signalCalibration || {};
  const eventQuality = overview.eventQuality || system.eventQuality || {};
  const production = overview.productionReadiness || system.productionReadiness || {};
  const queueHealth = system.queueHealth || {};
  const metrics = system.metrics || {};
  const events = safeArray(overview.recentEvents);
  const logs = safeArray(overview.recentLogs);
  const embeddings = safeArray(overview.recentEmbeddings);
  const failedEmbeddings = safeArray(overview.failedEmbeddings);
  const chatSummaries = safeArray(overview.recentChatSummaries);
  const creatorAffinities = safeArray(overview.profileArtifacts?.creatorAffinities);
  const activeHours = useMemo(() => createHourlyHeatmap(interestProfile.activeHours || []), [interestProfile.activeHours]);
  const eventSeries = useMemo(() => summarizeByDay(events), [events]);
  const embeddingSeries = useMemo(() => summarizeByDay(embeddings), [embeddings]);
  const eventTypeSeries = useMemo(() => summarizeByType(events), [events]);
  const queueSeries = useMemo(() => Object.entries(queueHealth?.queues || {}).map(([name, counts]) => ({ name, waiting: counts.waiting || 0, active: counts.active || 0, failed: counts.failed || 0 })), [queueHealth]);
  const retrievalMatches = safeArray(overview.userInspection?.retrieval?.matches || retrievalQuality.matches);

  const topInterestBars = safeArray(interestProfile.topInterests).slice(0, 6);

  const summaryCards = [
    {
      label: "Memories",
      value: formatCount(profile.memorySummaries?.length || safeArray(profile.memorySummaries).length || 0),
      note: `${formatCount(overview.userInspection?.retrieval?.matches?.length || 0)} matches under inspection`,
      icon: BrainCircuit,
      tone: "purple",
    },
    {
      label: "Interests",
      value: formatCount(topInterestBars.length || safeArray(interestProfile.topInterests).length),
      note: `${formatCount(safeArray(interestProfile.strongestCommunities).length)} communities`,
      icon: Sparkles,
      tone: "green",
    },
    {
      label: "Events (30d)",
      value: formatCount(eventQuality.eventThroughput?.totalEvents || events.length),
      note: `${formatPercent(eventQuality.duplicateSuppression?.duplicateSuppressionRate || 0)} duplicate suppression`,
      icon: Video,
      tone: "cyan",
    },
    {
      label: "Engagement",
      value: formatCount(Math.round((interestProfile.engagementStyle?.watchBias || 0) * 100)),
      note: `Primary mode: ${interestProfile.engagementStyle?.primaryMode || "balanced"}`,
      icon: Gauge,
      tone: "amber",
    },
    {
      label: "Memory Quality",
      value: formatPercent(retrievalQuality.retrievalQualityScore || 0),
      note: `${formatPercent(retrievalQuality.retrievedMemoryRelevance || 0)} retrieval relevance`,
      icon: ShieldCheck,
      tone: "green",
    },
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <YmeCard className="p-5" strong>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="h-22 w-22 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
                <img
                  src={user.profileImage || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"}
                  alt={user.username || "User avatar"}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-3xl font-semibold tracking-tight text-white">@{user.username || overview.userId || "user"}</h1>
                  <YmeBadge tone="good">Active</YmeBadge>
                </div>
                <p className="mt-2 text-sm text-slate-400">User ID: {overview.userId || "System sample"}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Inspect what the memory engine knows, how strong the behavioral signals are, and whether retrieval quality is being preserved.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Joined: {formatDate(profile.createdAt || user.createdAt || profile.joinedAt)}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Last active: {formatDate(user.lastSeen || user.lastLoginAt || profile.updatedAt)}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Memory quality: {formatPercent(retrievalQuality.retrievalQualityScore || 0)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[380px]">
              <SectionMetric label="Total memories" value={formatCount(profile.memorySummaries?.length || safeArray(profile.memorySummaries).length || 0)} note="Rolling summaries + profile state" />
              <SectionMetric label="Events" value={formatCount(eventQuality.eventThroughput?.totalEvents || events.length)} note={`${formatCount(eventQuality.eventThroughput?.processedCount || 0)} processed`} />
            </div>
          </div>
        </YmeCard>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {summaryCards.map((card) => (
            <YmeMetricCard key={card.label} label={card.label} value={card.value} note={card.note} icon={card.icon} tone={card.tone} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr_0.95fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Top interests" subtitle="Affinity percentages derived from memory, engagement, and creator signals." action={<Link to="/interests" className="text-sm font-semibold text-violet-200">View all <ArrowRight className="inline-block h-4 w-4" /></Link>} />
          <div className="mt-5 space-y-4">
            {topInterestBars.length ? topInterestBars.map((item) => (
              <YmeProgressRow
                key={item.label}
                label={item.label}
                value={formatPercent(item.score || 0)}
                percent={clamp(item.score || 0, 0, 1) * 100}
              />
            )) : (
              <YmeEmptyState title="No interests yet" description="The current sample does not contain enough stable topical signals." />
            )}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Engagement patterns" subtitle="Peak activity windows and interaction style." />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Active hours</p>
              <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6">
                {activeHours.map((slot) => (
                  <div
                    key={slot.hour}
                    className="group flex h-10 items-center justify-center rounded-[10px] border border-white/5 text-[11px] font-semibold text-slate-300 transition"
                    style={{
                      backgroundColor: `rgba(139, 92, 246, ${0.1 + slot.value * 0.88})`,
                    }}
                    title={`${slot.label}: ${formatPercent(slot.value || 0)}`}
                  >
                    {slot.hour}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                  <p>Watch behavior</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatDuration(interestProfile.engagementStyle?.watchTimeMs || 0)}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                  <p>Rewatch rate</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.rewatchProbability || 0)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Engagement style</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Primary mode</span>
                    <span className="font-semibold text-white">{interestProfile.engagementStyle?.primaryMode || "balanced"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Social bias</span>
                    <span className="font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.socialBias || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Creator bias</span>
                    <span className="font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.creatorBias || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Community bias</span>
                    <span className="font-semibold text-white">{formatPercent(interestProfile.engagementStyle?.communityBias || 0)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Behavior tags</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["High watch duration", "Active commenter", "Creator supporter", "Community participant"].map((item) => (
                    <YmeBadge key={item} tone="purple">{item}</YmeBadge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Creator affinity" subtitle="Creator-level relationship strength." action={<Link to="/creator-affinity" className="text-sm font-semibold text-violet-200">View all <ArrowRight className="inline-block h-4 w-4" /></Link>} />
          <div className="mt-4 space-y-3">
            {creatorAffinities.length ? creatorAffinities.slice(0, 5).map((item, index) => (
              <YmeProgressRow
                key={item.creatorId || item.label || index}
                label={item.creatorUsername || item.creatorId || `Creator ${index + 1}`}
                value={formatPercent(item.affinityScore || item.score || 0)}
                percent={clamp(item.affinityScore || item.score || 0, 0, 1) * 100}
                tone={index % 2 ? "cyan" : "violet"}
              />
            )) : (
              <YmeEmptyState title="No creator affinity yet" description="The sample does not contain enough creator interaction to rank affinity." />
            )}
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.12fr_1fr_0.9fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Live events feed" subtitle="Latest behavioral events with signal strength and importance." action={<YmeBadge tone="good">Live</YmeBadge>} />
          <div className="mt-4 space-y-3">
            {events.length ? events.slice(0, 8).map((event) => {
              const tone =
                event.eventType === "video_watch" || event.eventType === "watch_duration"
                  ? "good"
                  : event.eventType === "like"
                    ? "purple"
                    : event.eventType === "comment"
                      ? "warn"
                      : "neutral";

              return (
                <div key={event._id || event.id} className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <YmeBadge tone={tone}>{event.eventType || "event"}</YmeBadge>
                      <span className="text-xs text-slate-500">{formatDate(event.occurredAt || event.createdAt)}</span>
                    </div>
                    <p className="mt-2 truncate text-sm text-slate-300">
                      {event.summary || event.normalizedText || event.description || "No event summary available."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400">
                    <span>Signal {formatPercent(event.signalStrengthScore || 0)}</span>
                    <span>Importance {formatPercent(event.importanceScore || 0)}</span>
                  </div>
                </div>
              );
            }) : <YmeEmptyState title="No live events" description="Event ingestion is online but this sample has no recent user activity." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader
            title="Memory retrieval debugger"
            subtitle={overview.userInspection?.query ? `Query: ${overview.userInspection.query}` : "Use the user search to load a retrieval probe."}
            action={<Link to="/retrievals" className="text-sm font-semibold text-violet-200">Test retrieval <ArrowRight className="inline-block h-4 w-4" /></Link>}
          />
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SectionMetric label="Quality score" value={formatPercent(retrievalQuality.retrievalQualityScore || 0)} />
              <SectionMetric label="Average relevance" value={formatPercent(retrievalQuality.retrievedMemoryRelevance || 0)} />
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Retrieved memories</p>
              <div className="mt-3 space-y-3">
                {retrievalMatches.length ? retrievalMatches.slice(0, 5).map((match, index) => (
                  <div key={match.sourceId || index} className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{match.title || match.sourceType || "memory"}</p>
                        <p className="mt-1 text-xs text-slate-400">{match.reason || match.text || match.summary || "No reason supplied."}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400">
                        <span>S {formatPercent(match.retrievalScore || 0)}</span>
                        <span>I {formatPercent(match.importance || 0)}</span>
                      </div>
                    </div>
                  </div>
                )) : <YmeEmptyState title="No retrieval matches" description="Provide a query to inspect how memories are being ranked." />}
              </div>
            </div>
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="System health" subtitle="Queue state, latency, and infrastructure observability." action={<Link to="/queues" className="text-sm font-semibold text-violet-200">View all <ArrowRight className="inline-block h-4 w-4" /></Link>} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SectionMetric label="MongoDB" value="Healthy" note="Memory collections reachable" />
            <SectionMetric label="Redis / Queue" value={queueHealth.enabled ? "Healthy" : "Offline"} note={queueHealth.mode || "inline"} />
            <SectionMetric label="Vertex AI" value="Healthy" note="Embedding path enabled" />
            <SectionMetric label="API latency" value={formatDuration(metrics.durations?.eventIngestRequest?.p95Ms || metrics.durations?.memoryRetrieval?.p95Ms || 0)} note="P95 window" />
          </div>
          <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Queue counts</p>
            <div className="mt-3 space-y-3">
              {queueSeries.length ? queueSeries.map((queue) => (
                <div key={queue.name} className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{queue.name}</p>
                    <p className="text-xs text-slate-400">Waiting {queue.waiting}</p>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs text-slate-400">
                    <span>Active {queue.active}</span>
                    <span>Failed {queue.failed}</span>
                  </div>
                </div>
              )) : <YmeEmptyState title="No queue data" description="The queue health endpoint returned no live queue counts." />}
            </div>
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <YmeCard className="p-5 xl:col-span-2">
          <YmeCardHeader title="Event growth" subtitle="Daily event throughput and memory growth trend." />
          <div className="mt-4 h-[300px]">
            {eventSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventSeries}>
                  <defs>
                    <linearGradient id="ymeEventGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<YmeTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={3} fill="url(#ymeEventGrowth)" name="Events" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <YmeEmptyState title="No chart data" description="This sample is too small to render an event trend line." />
            )}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Event types" subtitle="Composition of the recent sample." />
          <div className="mt-4 h-[300px]">
            {eventTypeSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={eventTypeSeries.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={72} outerRadius={108} paddingAngle={3}>
                    {eventTypeSeries.slice(0, 6).map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<YmeTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <YmeEmptyState title="No event types" description="No recent events were available for the pie breakdown." />
            )}
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr_0.85fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Embeddings (30d)" subtitle="Generated memory embeddings and their trend." />
          <div className="mt-4 h-[260px]">
            {embeddingSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={embeddingSeries}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<YmeTooltip />} />
                  <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={3} dot={false} name="Embeddings" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <YmeEmptyState title="No embeddings" description="The current sample has no recent embeddings to chart." />
            )}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Quality metrics" subtitle="Signal, retrieval, and suppression quality." />
          <div className="mt-4 space-y-4">
            <SectionMetric label="Signal strength" value={formatPercent(signalCalibration.strongestSignals?.[0]?.signalStrengthScore || 0)} note={`Weak signals: ${formatCount(signalCalibration.weakSignals?.length || 0)}`} />
            <SectionMetric label="Retrieval quality" value={formatPercent(retrievalQuality.retrievalQualityScore || 0)} note={`Low-quality retrievals: ${formatCount(retrievalQuality.lowQualityRetrievalCount || 0)}`} />
            <SectionMetric label="Duplicate suppression" value={formatPercent(eventQuality.duplicateSuppression?.duplicateSuppressionRate || 0)} note={`Spam frequency: ${formatPercent(signalCalibration.spamFrequency || 0)}`} />
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Queue throughput" subtitle="Current queue status across event, embedding, and consolidation jobs." />
          <div className="mt-4 space-y-3">
            {queueSeries.length ? queueSeries.map((queue) => (
              <div key={queue.name} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">{queue.name}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <div className="rounded-[14px] bg-black/20 p-2">Waiting <span className="block text-sm font-semibold text-white">{queue.waiting}</span></div>
                  <div className="rounded-[14px] bg-black/20 p-2">Active <span className="block text-sm font-semibold text-white">{queue.active}</span></div>
                  <div className="rounded-[14px] bg-black/20 p-2">Failed <span className="block text-sm font-semibold text-white">{queue.failed}</span></div>
                </div>
              </div>
            )) : <YmeEmptyState title="No queue throughput" description="The queue health endpoint returned no active queues." />}
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <YmeCard className="p-5">
          <YmeCardHeader title="Recent logs" subtitle="Pipeline and inspection logs." />
          <YmeList
            items={logs.slice(0, 5)}
            emptyLabel="No logs available."
            renderItem={(log) => (
              <div key={log._id || log.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">{log.stage || log.level || "log"}</p>
                <p className="mt-2 text-xs leading-6 text-slate-400">{log.message || log.summary || "No message"}</p>
              </div>
            )}
          />
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Failed embeddings" subtitle="Items that need inspection or retry." />
          <YmeList
            items={failedEmbeddings.slice(0, 5)}
            emptyLabel="No failed embeddings."
            renderItem={(item, index) => (
              <div key={item._id || index} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">{item.sourceType || "embedding"}</p>
                <p className="mt-1 text-xs text-slate-400">{item.errorMessage || item.status || "Failed"}</p>
              </div>
            )}
          />
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Chat summaries" subtitle="Rolling context produced by memory consolidation." />
          <YmeList
            items={chatSummaries.slice(0, 5)}
            emptyLabel="No summaries available."
            renderItem={(summary) => (
              <div key={summary._id || summary.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">{summary.conversationId || "conversation"}</p>
                <p className="mt-1 text-xs leading-6 text-slate-400">{summary.summary || "No summary text."}</p>
              </div>
            )}
          />
        </YmeCard>
      </div>

      {error ? (
        <YmeCard className="border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          Failed to load inspector data: {error}
        </YmeCard>
      ) : null}

      {loading ? (
        <YmeCard className="p-4 text-sm text-slate-300">Loading YME inspector data...</YmeCard>
      ) : null}
    </div>
  );
}
