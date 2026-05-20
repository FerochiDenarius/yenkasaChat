import { ShieldAlert, Siren, UserRoundX } from "lucide-react";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import StatCard from "../../components/ai/StatCard";
import StatusPill from "../../components/ai/StatusPill";
import { moderationAlerts, moderationMetrics, moderationQueue } from "../../services/ai/mockData";

export default function AiModerationConsolePage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Moderation Console"
        title="Realtime risk operations across posts, livestreams, and communities"
        description="Designed as an operator console: high-risk signals first, manual queue second, and livestream alerting kept visible."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {moderationMetrics.map((metric) => (
          <StatCard
            key={metric.title}
            label={metric.title}
            value={metric.value}
            note={metric.delta}
            tone={metric.tone}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <ShieldAlert className="h-4 w-4" />
            Pending review queue
          </div>
          <div className="mt-5 space-y-4">
            {moderationQueue.map((item) => (
              <div key={item.id} className="rounded-[26px] border border-white/50 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-[var(--ai-text)]">{item.title}</h3>
                      <StatusPill tone={item.risk > 0.9 ? "danger" : item.risk > 0.75 ? "warning" : "neutral"}>
                        Risk {(item.risk * 100).toFixed(0)}%
                      </StatusPill>
                    </div>
                    <p className="ai-muted mt-2 text-sm">{item.owner}</p>
                    <p className="mt-4 text-sm leading-7 text-[var(--ai-text)]">{item.reason}</p>
                    <p className="ai-muted mt-3 text-sm">Recommended action: {item.action}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white">Approve</button>
                    <button className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="rounded-[32px] p-6" strong>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <Siren className="h-4 w-4" />
              Livestream alerts
            </div>
            <div className="mt-5 space-y-3">
              {moderationAlerts.map((alert) => (
                <div key={alert} className="rounded-[24px] border border-rose-200/60 bg-rose-50/70 p-4 text-sm leading-7 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                  {alert}
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="rounded-[32px] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <UserRoundX className="h-4 w-4" />
              Toxicity distribution
            </div>
            <div className="mt-5 grid gap-4">
              {[
                { label: "Clean", width: 74, tone: "from-emerald-500 to-emerald-400" },
                { label: "Watch", width: 19, tone: "from-amber-500 to-orange-400" },
                { label: "Block", width: 7, tone: "from-rose-500 to-red-400" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="ai-muted">{item.label}</span>
                    <span className="font-medium text-[var(--ai-text)]">{item.width}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/70 dark:bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: `${item.width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
