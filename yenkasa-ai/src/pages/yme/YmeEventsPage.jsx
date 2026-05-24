import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Activity, ShieldCheck, Video } from "lucide-react";
import { YmeBadge, YmeCard, YmeCardHeader, YmeEmptyState, YmeMetricCard } from "../../components/yme/YmePrimitives";
import { useYmeInspector } from "../../services/yme/useYmeInspector";
import { formatCount, formatDate, formatPercent, safeArray, summarizeByDay } from "../../services/yme/ymeHelpers";

function TooltipCard({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-white/10 bg-[#090b12] px-4 py-3 text-xs text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <p className="font-semibold text-white">{label}</p>
      <p className="mt-2 text-slate-300">{payload[0]?.value} events</p>
    </div>
  );
}

export default function YmeEventsPage() {
  const { refreshSignal } = useOutletContext() || {};
  const { data, loading, error } = useYmeInspector({ limit: 60, refreshSignal });
  const overview = data || {};
  const eventQuality = overview.eventQuality || overview.system?.eventQuality || {};
  const signalCalibration = overview.signalCalibration || {};
  const events = safeArray(overview.recentEvents);
  const eventSeries = useMemo(() => summarizeByDay(events), [events]);

  const metrics = [
    { label: "Total events", value: formatCount(eventQuality.eventThroughput?.totalEvents || events.length), note: "Recent sample", icon: Video, tone: "purple" },
    { label: "Duplicate suppression", value: formatPercent(eventQuality.duplicateSuppression?.duplicateSuppressionRate || 0), note: "Noise reduced", icon: ShieldCheck, tone: "green" },
    { label: "Failed events", value: formatCount(eventQuality.eventThroughput?.failedCount || 0), note: "Needs inspection", icon: Activity, tone: "amber" },
    { label: "Spam frequency", value: formatPercent(signalCalibration.spamFrequency || 0), note: "Signal audit", icon: ShieldCheck, tone: "cyan" },
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">Live events</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Event quality and ingestion visibility</h1>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
          Back to overview <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <YmeMetricCard key={metric.label} {...metric} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Event growth" subtitle="The most recent sample plotted over time." />
          <div className="mt-4 h-[300px]">
            {eventSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventSeries}>
                  <defs>
                    <linearGradient id="ymeEventsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipCard />} />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} fill="url(#ymeEventsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <YmeEmptyState title="No event trend" description="This sample is too small to produce a stable line chart." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Signal calibration" subtitle="Track strong, weak, and noisy event types." />
          <div className="mt-4 space-y-3">
            {safeArray(signalCalibration.strongestSignals).slice(0, 4).map((signal) => (
              <div key={signal.eventType} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{signal.eventType}</p>
                  <YmeBadge tone="good">{formatPercent(signal.signalStrengthScore || 0)}</YmeBadge>
                </div>
                <p className="mt-2 text-xs text-slate-400">Usefulness {formatPercent(signal.eventUsefulnessScore || 0)} · Spam {formatPercent(signal.spamRate || 0)}</p>
              </div>
            ))}
          </div>
        </YmeCard>
      </div>

      <YmeCard className="p-5">
        <YmeCardHeader title="Live event feed" subtitle="Recent activity flowing through the behavioral memory pipeline." />
        <div className="mt-4 space-y-3">
          {events.length ? events.slice(0, 18).map((event) => (
            <div key={event._id || event.id} className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <YmeBadge tone={event.eventType === "watch_duration" || event.eventType === "video_watch" ? "good" : event.eventType === "comment" ? "warn" : "purple"}>
                    {event.eventType || "event"}
                  </YmeBadge>
                  <span className="text-xs text-slate-500">{formatDate(event.occurredAt || event.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-300">{event.summary || event.normalizedText || "No summary available."}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">Signal {formatPercent(event.signalStrengthScore || 0)}</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">Importance {formatPercent(event.importanceScore || 0)}</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">Embed {event.shouldEmbed ? "yes" : "no"}</span>
              </div>
            </div>
          )) : <YmeEmptyState title="No live events" description="There are no recent events in the current sample." />}
        </div>
      </YmeCard>

      {error ? <YmeCard className="border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">Failed to load events: {error}</YmeCard> : null}
      {loading ? <YmeCard className="p-4 text-sm text-slate-300">Loading events...</YmeCard> : null}
    </div>
  );
}
