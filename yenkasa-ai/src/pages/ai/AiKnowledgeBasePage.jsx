import { Database, FolderOpen, SearchCheck } from "lucide-react";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import StatCard from "../../components/ai/StatCard";
import StatusPill from "../../components/ai/StatusPill";
import UploadDropzone from "../../components/ai/UploadDropzone";
import {
  knowledgeCategories,
  knowledgeDocuments,
  vectorStats,
} from "../../services/ai/mockData";

export default function AiKnowledgeBasePage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Knowledge Base"
        title="Corpus health, document categories, and retrieval readiness"
        description="This page is tuned for ingestion monitoring rather than generic file storage. It highlights corpus shape, retrieval readiness, and vector statistics."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {vectorStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} note={stat.note} />
        ))}
      </div>

      <UploadDropzone />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <FolderOpen className="h-4 w-4" />
            Categories
          </div>
          <div className="mt-5 space-y-4">
            {knowledgeCategories.map((category) => (
              <div key={category.name} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ai-text)]">{category.name}</h3>
                    <p className="ai-muted mt-1 text-sm">{category.files} files indexed</p>
                  </div>
                  <StatusPill tone={category.health === "Healthy" ? "success" : "warning"}>{category.health}</StatusPill>
                </div>
                <div className="mt-4 h-2 rounded-full bg-ai-100/80 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ai-500 to-blue-500"
                    style={{ width: `${Math.min(100, category.chunks)}%` }}
                  />
                </div>
                <p className="ai-subtle mt-3 text-xs uppercase tracking-[0.16em]">{category.chunks} chunks</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Database className="h-4 w-4" />
            Indexed documents
          </div>
          <div className="ai-scroll mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
                  <th className="px-4">Document</th>
                  <th className="px-4">Category</th>
                  <th className="px-4">Chunks</th>
                  <th className="px-4">Last Ingested</th>
                  <th className="px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {knowledgeDocuments.map((doc) => (
                  <tr key={doc.name} className="rounded-[24px] bg-white/75 shadow-sm dark:bg-white/5">
                    <td className="rounded-l-[22px] px-4 py-4 font-medium text-[var(--ai-text)]">{doc.name}</td>
                    <td className="px-4 py-4 text-[var(--ai-text)]">{doc.category}</td>
                    <td className="px-4 py-4 text-[var(--ai-text)]">{doc.chunks}</td>
                    <td className="px-4 py-4 text-[var(--ai-text)]">{doc.lastIngested}</td>
                    <td className="rounded-r-[22px] px-4 py-4">
                      <StatusPill tone="success">{doc.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="rounded-[32px] p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
          <SearchCheck className="h-4 w-4" />
          Retrieval quality indicators
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">Top-k recall</p>
            <h3 className="mt-3 text-3xl font-semibold text-[var(--ai-text)]">0.91</h3>
            <p className="ai-muted mt-2 text-sm">Strong for architecture and moderation prompts.</p>
          </div>
          <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">Mixed corpus risk</p>
            <h3 className="mt-3 text-3xl font-semibold text-[var(--ai-text)]">Medium</h3>
            <p className="ai-muted mt-2 text-sm">Research papers can still surface beside internal docs.</p>
          </div>
          <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">Gemini embedding path</p>
            <h3 className="mt-3 text-3xl font-semibold text-[var(--ai-text)]">Ready</h3>
            <p className="ai-muted mt-2 text-sm">Generation already uses Vertex AI; embeddings can migrate next.</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
