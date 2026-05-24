import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, FolderOpen, Server, TimerReset } from "lucide-react";
import { YmeBadge, YmeCard, YmeCardHeader, YmeEmptyState, YmeMetricCard } from "../../components/yme/YmePrimitives";
import { useYmeInspector } from "../../services/yme/useYmeInspector";
import { formatCount, formatDuration, formatPercent, safeArray, summarizeQueueSeries } from "../../services/yme/ymeHelpers";

function TooltipCard({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-white/10 bg-[#090b12] px-4 py-3 text-xs text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <p className="font-semibold text-white">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p key={entry.dataKey} className="text-slate-300">
            {entry.dataKey}: <span className="font-semibold text-white">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export default function YmeQueuesPage() {
  const { refreshSignal } = useOutletContext() || {};
  const { data, loading, error } = useYmeInspector({ limit: 40, refreshSignal });
  const overview = data || {};
  const queueHealth = overview.system?.queueHealth || {};
  const metrics = overview.system?.metrics || {};
  const queueSeries = useMemo(() => summarizeQueueSeries(queueHealth), [queueHealth]);
  const totalWaiting = queueSeries.reduce((sum, queue) => sum + queue.pending, 0);
  const failedJobs = safeArray(overview.failedEmbeddings).length;

  const cards = [
    { label: "Queue health", value: queueHealth.enabled ? "Healthy" : "Offline", note: queueHealth.mode || "inline", icon: Server, tone: "green" },
    { label: "Waiting jobs", value: formatCount(totalWaiting), note: "Across queues", icon: FolderOpen, tone: "purple" },
    { label: "Failed jobs", value: formatCount(failedJobs), note: "Inspection required", icon: TimerReset, tone: "amber" },
    { label: "P95 latency", value: formatDuration(metrics.durations?.queueProcess?.p95Ms || 0), note: "Queue processing", icon: TimerReset, tone: "cyan" },
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">Queues & jobs</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Queue health and work distribution</h1>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
          Back to overview <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <YmeMetricCard key={card.label} {...card} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Queue throughput" subtitle="Waiting, active, and failed job counts by queue." />
          <div className="mt-4 h-[320px]">
            {queueSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queueSeries}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCard />} />
                  <Bar dataKey="pending" stackId="a" fill="#8b5cf6" name="waiting" />
                  <Bar dataKey="active" stackId="a" fill="#38bdf8" name="active" />
                  <Bar dataKey="failed" stackId="a" fill="#f97316" name="failed" />
                </BarChart>
              </ResponsiveContainer>
            ) : <YmeEmptyState title="No queue data" description="The queue health endpoint did not return any live queue stats." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="System health" subtitle="Key backing services and the queue orchestration layer." />
          <div className="mt-4 space-y-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">MongoDB</p>
                <YmeBadge tone="good">Healthy</YmeBadge>
              </div>
              <p className="mt-2 text-sm text-slate-400">Memory collections and retrieval indexes are reachable through the inspector path.</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Redis / BullMQ</p>
                <YmeBadge tone={queueHealth.enabled ? "good" : "warn"}>{queueHealth.enabled ? "Healthy" : "Offline"}</YmeBadge>
              </div>
              <p className="mt-2 text-sm text-slate-400">{queueHealth.mode || "inline"} mode · event, embedding, consolidation, and chat summary workers.</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Vertex AI</p>
                <YmeBadge tone="good">Healthy</YmeBadge>
              </div>
              <p className="mt-2 text-sm text-slate-400">Embedding pressure and cost protection are surfaced in the production readiness panel.</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">API latency</p>
                <YmeBadge tone="purple">{formatDuration(metrics.durations?.eventIngestRequest?.p95Ms || 0)}</YmeBadge>
              </div>
              <p className="mt-2 text-sm text-slate-400">P95 values are sourced from the in-memory metrics snapshot exposed by YME.</p>
            </div>
          </div>
        </YmeCard>
      </div>

      {error ? <YmeCard className="border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">Failed to load queue data: {error}</YmeCard> : null}
      {loading ? <YmeCard className="p-4 text-sm text-slate-300">Loading queue health...</YmeCard> : null}
    </div>
  );
}
