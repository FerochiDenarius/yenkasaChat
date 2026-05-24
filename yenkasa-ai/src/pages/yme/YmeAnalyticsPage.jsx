import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, Database, ShieldAlert, Sparkles } from "lucide-react";
import { YmeBadge, YmeCard, YmeCardHeader, YmeEmptyState, YmeMetricCard } from "../../components/yme/YmePrimitives";
import { useYmeInspector } from "../../services/yme/useYmeInspector";
import { clamp, formatCount, formatPercent, safeArray, summarizeByDay, summarizeByType } from "../../services/yme/ymeHelpers";

const PIE_COLORS = ["#8b5cf6", "#22c55e", "#38bdf8", "#f59e0b", "#ec4899", "#f97316"];

function TooltipCard({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-white/10 bg-[#090b12] px-4 py-3 text-xs text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <p className="font-semibold text-white">{label}</p>
      <p className="mt-2 text-slate-300">{payload[0]?.value}</p>
    </div>
  );
}

export default function YmeAnalyticsPage() {
  const { refreshSignal } = useOutletContext() || {};
  const { data, loading, error } = useYmeInspector({ limit: 60, refreshSignal });
  const overview = data || {};
  const production = overview.productionReadiness || overview.system?.productionReadiness || {};
  const eventQuality = overview.eventQuality || overview.system?.eventQuality || {};
  const costProtection = overview.costProtection || overview.system?.costProtection || {};
  const memoryOptimization = overview.memoryOptimization || overview.system?.memoryOptimization || {};
  const events = safeArray(overview.recentEvents);
  const embeddings = safeArray(overview.recentEmbeddings);
  const eventSeries = useMemo(() => summarizeByDay(events), [events]);
  const embeddingSeries = useMemo(() => summarizeByDay(embeddings), [embeddings]);
  const eventTypes = useMemo(() => summarizeByType(events), [events]);

  const cards = [
    { label: "Rollout readiness", value: production.maturityAssessment?.readyForLimitedRollout ? "Ready" : "Tuning", note: production.maturityAssessment?.stage || "Visibility-first hardening", icon: ShieldAlert, tone: production.maturityAssessment?.readyForLimitedRollout ? "green" : "amber" },
    { label: "Growth rate", value: formatCount(eventQuality.eventThroughput?.throughputPerDay || 0), note: "Events/day", icon: BarChart3, tone: "purple" },
    { label: "Monthly Mongo growth", value: `${production.mongoGrowthProjection?.estimatedMonthlyGrowthMb || 0} MB`, note: "Heuristic projection", icon: Database, tone: "cyan" },
    { label: "Vertex pressure", value: formatPercent(Math.min(1, (production.vertexAiCostProjection?.embeddingPressureScore || 0) / 10)), note: production.vertexAiCostProjection?.requestPressure || "low", icon: Sparkles, tone: "green" },
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">Analytics</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Production readiness and cost control</h1>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
          Back to overview <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <YmeMetricCard key={card.label} {...card} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Event growth" subtitle="Events per day from the current inspector sample." />
          <div className="mt-4 h-[300px]">
            {eventSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventSeries}>
                  <defs>
                    <linearGradient id="ymeAnalyticsEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCard />} />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} fill="url(#ymeAnalyticsEvents)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <YmeEmptyState title="No event chart data" description="The current sample does not have enough events to chart." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Event composition" subtitle="Recent event-type distribution." />
          <div className="mt-4 h-[300px]">
            {eventTypes.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={eventTypes.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={70} outerRadius={112} paddingAngle={4}>
                    {eventTypes.slice(0, 6).map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<TooltipCard />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <YmeEmptyState title="No event breakdown" description="The current sample does not include event-type data." />}
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Embedding growth" subtitle="How many memory embeddings were generated in the sample window." />
          <div className="mt-4 h-[280px]">
            {embeddingSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={embeddingSeries}>
                  <defs>
                    <linearGradient id="ymeAnalyticsEmbeddings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCard />} />
                  <Area type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={3} fill="url(#ymeAnalyticsEmbeddings)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <YmeEmptyState title="No embedding chart" description="There are no recent embeddings in the sample window." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Production readiness" subtitle="What still needs tuning before wider rollout." />
          <div className="mt-4 space-y-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Maturity</p>
              <p className="mt-2 text-lg font-semibold text-white">{production.maturityAssessment?.stage || "—"}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mongo growth projection</p>
              <p className="mt-2 text-lg font-semibold text-white">{production.mongoGrowthProjection?.estimatedMonthlyGrowthMb || 0} MB / month</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Vertex AI cost pressure</p>
              <p className="mt-2 text-lg font-semibold text-white">{production.vertexAiCostProjection?.requestPressure || "low"}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Duplicate suppression</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatPercent(eventQuality.duplicateSuppression?.duplicateSuppressionRate || 0)}</p>
            </div>
          </div>
        </YmeCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <YmeCard className="p-5">
          <YmeCardHeader title="Cost protection strategy" subtitle="Throttle, batch, cache, and rate-limit before scaling more memory volume." />
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            {safeArray(costProtection.embeddingThrottling).slice(0, 4).map((item) => <p key={item} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">{item}</p>)}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Memory optimization strategy" subtitle="Cleanup, pruning, and retention policies." />
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            {safeArray(memoryOptimization.retentionPolicies).slice(0, 4).map((item) => <p key={item} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">{item}</p>)}
          </div>
        </YmeCard>
      </div>

      {error ? <YmeCard className="border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">Failed to load analytics: {error}</YmeCard> : null}
      {loading ? <YmeCard className="p-4 text-sm text-slate-300">Loading analytics...</YmeCard> : null}
    </div>
  );
}
