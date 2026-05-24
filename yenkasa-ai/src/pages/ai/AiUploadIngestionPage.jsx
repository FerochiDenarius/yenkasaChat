import { useEffect, useMemo, useState } from "react";
import { CloudUpload, Database, Layers3, Workflow } from "lucide-react";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import StatusPill from "../../components/ai/StatusPill";
import UploadDropzone from "../../components/ai/UploadDropzone";
import { apiEndpoints, ingestionJobs as mockIngestionJobs, ingestionStages } from "../../services/ai/mockData";
import { enqueueKnowledgeFiles, fetchIngestionJobs } from "../../services/ai/platformService";

export default function AiUploadIngestionPage() {
  const [lastSubmission, setLastSubmission] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [liveJobs, setLiveJobs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function refreshJobs() {
      try {
        const response = await fetchIngestionJobs();
        if (!cancelled) {
          setLiveJobs(Array.isArray(response?.jobs) ? response.jobs : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setLiveJobs([]);
        }
      }
    }

    refreshJobs();
    intervalId = window.setInterval(refreshJobs, 5000);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  async function handleFiles(files) {
    setErrorMessage("");
    try {
      const response = await enqueueKnowledgeFiles(files);
      setLastSubmission(response);
      const jobsResponse = await fetchIngestionJobs();
      setLiveJobs(Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  const renderedJobs = liveJobs.length ? liveJobs : mockIngestionJobs;

  const queueStats = useMemo(
    () => ({
      running: renderedJobs.filter((job) => job.status === "Running").length,
      queued: renderedJobs.filter((job) => job.status === "Queued").length,
      completed: renderedJobs.filter((job) => job.status === "Completed").length,
    }),
    [renderedJobs]
  );

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Upload & Ingestion"
        title="Pipeline jobs, chunking stages, and future API integration"
        description="This page is the operator surface for ingestion into YenkasaAI. It is deliberately closer to a control plane than a simple upload form."
      />

      <UploadDropzone onFiles={handleFiles} />

      {errorMessage ? (
        <GlassCard className="rounded-[28px] border border-rose-200/70 bg-rose-50/80 p-5 dark:border-rose-500/20 dark:bg-rose-500/10">
          <p className="text-sm text-rose-700 dark:text-rose-100">{errorMessage}</p>
        </GlassCard>
      ) : null}

      {lastSubmission ? (
        <GlassCard className="rounded-[28px] p-5">
          <p className="text-sm text-[var(--ai-text)]">
            Accepted
            {" "}
            <strong>{lastSubmission.accepted}</strong>
            {" "}
            files into
            {" "}
            <strong>{lastSubmission.targetCollection}</strong>
            . Next job:
            {" "}
            <strong>{lastSubmission.nextJob.name}</strong>
            .
          </p>
        </GlassCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Workflow className="h-4 w-4" />
            Ingestion stages
          </div>
          <div className="mt-5 space-y-4">
            {ingestionStages.map((stage, index) => (
              <div key={stage.name} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ai-100 text-ai-700 dark:bg-white/10 dark:text-ai-200">
                    {index + 1}
                  </div>
                  {index < ingestionStages.length - 1 ? <div className="ai-thread-line mt-3 h-16 w-px rounded-full" /> : null}
                </div>
                <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-[var(--ai-text)]">{stage.name}</h3>
                    <StatusPill
                      tone={
                        stage.status === "done" ? "success" : stage.status === "active" ? "warning" : "neutral"
                      }
                    >
                      {stage.status}
                    </StatusPill>
                  </div>
                  <p className="ai-muted mt-2 text-sm">{stage.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="rounded-[32px] p-6" strong>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <Layers3 className="h-4 w-4" />
              Active queue
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="ai-muted text-sm">Running</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">{queueStats.running}</p>
              </div>
              <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="ai-muted text-sm">Queued</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">{queueStats.queued}</p>
              </div>
              <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="ai-muted text-sm">Completed</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">{queueStats.completed}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {renderedJobs.map((job) => (
                <div key={job.id} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--ai-text)]">{job.name}</h3>
                      <p className="ai-muted mt-1 text-sm">{job.target}</p>
                    </div>
                    <StatusPill
                      tone={job.status === "Completed" ? "success" : job.status === "Running" ? "warning" : "neutral"}
                    >
                      {job.status}
                    </StatusPill>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-ai-100/80 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ai-500 to-blue-500"
                      style={{ width: `${Math.max(8, job.progress)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                    <span>{job.progress}% complete</span>
                    <span>{job.eta}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="rounded-[32px] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <CloudUpload className="h-4 w-4" />
              FastAPI integration plan
            </div>
            <div className="mt-5 space-y-3">
              {apiEndpoints.map((endpoint) => (
                <div key={endpoint.name} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="font-mono text-sm font-medium text-[var(--ai-text)]">{endpoint.name}</p>
                  <p className="ai-muted mt-2 text-sm">{endpoint.purpose}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[24px] border border-white/50 bg-gradient-to-r from-ai-600 to-blue-500 p-5 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4" />
                Live FastAPI service boundary
              </div>
              <p className="mt-2 text-sm leading-7 text-white/80">
                This UI now posts through the backend YenkasaAI bridge, which forwards retrieval and ingestion into the existing RAG stack.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
