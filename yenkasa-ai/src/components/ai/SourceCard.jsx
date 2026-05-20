import { FileText, Network } from "lucide-react";
import GlassCard from "./GlassCard";

export default function SourceCard({ source }) {
  return (
    <GlassCard className="p-5" hover>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <FileText className="h-4 w-4" />
            {source.area}
          </div>
          <h4 className="mt-2 truncate text-sm font-semibold text-[var(--ai-text)]">{source.title}</h4>
          {source.citation ? <p className="ai-subtle mt-1 text-xs">{source.citation}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-ai-700 dark:text-ai-200">
            {(source.score * 100).toFixed(0)}%
          </div>
          <div className="ai-subtle text-xs">retrieval fit</div>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-ai-100/80 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-ai-500 to-blue-500"
          style={{ width: `${Math.max(12, source.score * 100)}%` }}
        />
      </div>
      <p className="ai-muted mt-4 text-sm leading-6">{source.excerpt}</p>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="ai-subtle">{source.freshness}</span>
        <span className="inline-flex items-center gap-1 text-ai-700 dark:text-ai-200">
          <Network className="h-3.5 w-3.5" />
          {source.chunks} chunks
        </span>
      </div>
    </GlassCard>
  );
}
