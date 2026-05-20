import { BadgeInfo } from "lucide-react";
import GlassCard from "./GlassCard";

export default function AnswerCard({ card }) {
  return (
    <GlassCard className="p-5" hover>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <BadgeInfo className="h-4 w-4" />
            {card.category}
          </div>
          <h4 className="mt-2 text-sm font-semibold text-[var(--ai-text)]">{card.title}</h4>
        </div>
      </div>
      <p className="ai-muted mt-3 text-sm leading-6">{card.summary}</p>
    </GlassCard>
  );
}
