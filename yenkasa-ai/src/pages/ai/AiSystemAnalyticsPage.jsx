import { ActivitySquare, BarChart3, Gauge, HeartPulse } from "lucide-react";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import StatCard from "../../components/ai/StatCard";
import { analyticsHealth, latencySeries, volumeSeries } from "../../services/ai/mockData";

function maxOf(items, key) {
  return Math.max(...items.map((item) => item[key]));
}

export default function AiSystemAnalyticsPage() {
  const maxLatency = maxOf(latencySeries, "generation");
  const maxVolume = maxOf(volumeSeries, "value");

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="System Analytics"
        title="Latency, throughput, retrieval quality, and service health"
        description="A productized AI system needs to make infrastructure visible. These cards and charts are built around that discipline."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analyticsHealth.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} note={card.trend} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Gauge className="h-4 w-4" />
            Retrieval and generation latency
          </div>
          <div className="mt-6 grid grid-cols-6 items-end gap-4">
            {latencySeries.map((point) => (
              <div key={point.label} className="flex flex-col items-center gap-3">
                <div className="flex h-56 items-end gap-2">
                  <div
                    className="ai-chart-bar w-5 rounded-t-2xl"
                    style={{ height: `${Math.max(30, (point.retrieval / maxLatency) * 220)}px` }}
                    title={`Retrieval ${point.retrieval}ms`}
                  />
                  <div
                    className="w-5 rounded-t-2xl bg-gradient-to-t from-blue-500 to-cyan-400"
                    style={{ height: `${Math.max(30, (point.generation / maxLatency) * 220)}px` }}
                    title={`Generation ${point.generation}ms`}
                  />
                </div>
                <span className="ai-subtle text-xs">{point.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <BarChart3 className="h-4 w-4" />
            Request volume
          </div>
          <div className="mt-6 space-y-4">
            {volumeSeries.map((point) => (
              <div key={point.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="ai-muted">{point.label}</span>
                  <span className="font-medium text-[var(--ai-text)]">{point.value}</span>
                </div>
                <div className="h-3 rounded-full bg-white/70 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ai-500 to-blue-500"
                    style={{ width: `${Math.max(18, (point.value / maxVolume) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="rounded-[32px] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <HeartPulse className="h-4 w-4" />
            System health cards
          </div>
          <div className="mt-5 space-y-4">
            {[
              { label: "Vertex AI generation", value: "Operational", tone: "text-emerald-600 dark:text-emerald-300" },
              { label: "Chroma persistence", value: "Healthy", tone: "text-emerald-600 dark:text-emerald-300" },
              { label: "Socket moderation feed", value: "Watch", tone: "text-amber-600 dark:text-amber-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="ai-muted text-sm">{item.label}</p>
                <p className={`mt-2 text-lg font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <ActivitySquare className="h-4 w-4" />
            Embedding statistics
          </div>
          <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--ai-text)]">
            <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              Current backend: HuggingFace sentence-transformers
            </div>
            <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              Generation backend: Vertex AI Gemini 2.5 Flash
            </div>
            <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              Migration note: keep retrieval and generation layers decoupled until vector DB rebuild is scheduled.
            </div>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <BarChart3 className="h-4 w-4" />
            Moderation trend line
          </div>
          <div className="mt-5 space-y-4">
            {[
              { label: "Flagged livestream events", delta: "+14%" },
              { label: "Post moderation backlog", delta: "-8%" },
              { label: "Comment toxicity bursts", delta: "+3%" },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm font-medium text-[var(--ai-text)]">{item.label}</p>
                <p className="mt-2 text-sm text-ai-700 dark:text-ai-200">{item.delta}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
