import { useEffect, useMemo, useState } from "react";
import { CloudUpload, Database, FileText, Layers3, Workflow } from "lucide-react";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import StatusPill from "../../components/ai/StatusPill";
import UploadDropzone from "../../components/ai/UploadDropzone";
import { apiEndpoints } from "../../services/ai/mockData";
import {
  enqueueKnowledgeFiles,
  fetchIngestionJobs,
  supportsIngestionJobs,
  subscribeToIngestionJobs,
} from "../../services/ai/platformService";

const LIVE_STAGES = [
  {
    key: "queued",
    name: "Queue upload",
    detail: "Selected files are accepted and staged for the ingest worker.",
  },
  {
    key: "validating",
    name: "Validate files",
    detail: "The worker checks duplicates, empty files, and extractable text before chunking.",
  },
  {
    key: "chunking",
    name: "Chunk documents",
    detail: "Each document is loaded and split into retrieval-sized chunks.",
  },
  {
    key: "embedding",
    name: "Generate embeddings",
    detail: "Chunks are embedded and written into Chroma in batches.",
  },
  {
    key: "persisting",
    name: "Persist to Chroma",
    detail: "The Chroma snapshot is flushed to disk after batch writes finish.",
  },
  {
    key: "refreshing",
    name: "Refresh runtime",
    detail: "The API reloads the vector store so new uploads become searchable immediately.",
  },
  {
    key: "confirming",
    name: "Confirm in database",
    detail: "Each selected file is checked against the Chroma collection to prove it landed.",
  },
];

const STAGE_ORDER = {
  queued: 0,
  validating: 1,
  chunking: 2,
  embedding: 3,
  persisting: 4,
  refreshing: 5,
  confirming: 6,
  completed: 7,
  failed: 7,
};

function getJobTone(status) {
  if (status === "Completed") {
    return "success";
  }
  if (status === "Failed") {
    return "danger";
  }
  if (status === "Running") {
    return "warning";
  }
  return "neutral";
}

function getFileTone(file) {
  if (file?.status === "Failed" || file?.inVectorDb === false) {
    return "danger";
  }
  if (file?.inVectorDb === true || file?.status === "Duplicate") {
    return "success";
  }
  if (file?.status === "Processing" || file?.status === "Indexed") {
    return "warning";
  }
  return "neutral";
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "Waiting";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getStageStatus(stageKey, job) {
  if (!job) {
    return "queued";
  }

  if (job.status === "Completed") {
    return "done";
  }

  const currentKey = job.stageKey || "queued";
  const currentIndex = STAGE_ORDER[currentKey] ?? 0;
  const stageIndex = STAGE_ORDER[stageKey] ?? 0;

  if (job.status === "Failed") {
    if (stageIndex < currentIndex) {
      return "done";
    }
    if (stageIndex === currentIndex) {
      return "failed";
    }
    return "queued";
  }

  if (stageIndex < currentIndex) {
    return "done";
  }

  if (stageKey === currentKey) {
    return "active";
  }

  return "queued";
}

function getStreamTone(streamMode) {
  if (streamMode === "direct") {
    return "success";
  }
  if (streamMode === "live") {
    return "success";
  }
  if (streamMode === "reconnecting") {
    return "warning";
  }
  return "neutral";
}

function getStreamLabel(streamMode) {
  if (streamMode === "direct") {
    return "Production backend";
  }
  if (streamMode === "live") {
    return "Realtime stream";
  }
  if (streamMode === "reconnecting") {
    return "Reconnecting";
  }
  return "Polling fallback";
}

export default function AiUploadIngestionPage() {
  const [lastSubmission, setLastSubmission] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [liveJobs, setLiveJobs] = useState([]);
  const [streamMode, setStreamMode] = useState(supportsIngestionJobs() ? "polling" : "direct");
  const ingestionJobsSupported = supportsIngestionJobs();

  useEffect(() => {
    if (!ingestionJobsSupported) {
      setLiveJobs([]);
      setStreamMode("direct");
      return undefined;
    }

    let cancelled = false;
    let pollId = null;

    function applyJobsPayload(payload) {
      if (cancelled) {
        return;
      }
      setLiveJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
    }

    async function refreshJobs() {
      try {
        const response = await fetchIngestionJobs();
        applyJobsPayload(response);
      } catch (_error) {
        if (!cancelled) {
          setLiveJobs([]);
        }
      }
    }

    refreshJobs();

    const eventSource = subscribeToIngestionJobs({
      onMessage: (payload) => {
        if (cancelled) {
          return;
        }
        setStreamMode("live");
        applyJobsPayload(payload);
      },
      onError: () => {
        if (cancelled) {
          return;
        }
        setStreamMode((current) => (current === "live" ? "reconnecting" : "polling"));
      },
    });

    if (!eventSource) {
      setStreamMode("polling");
    }

    // Polling remains in place as a fallback if the browser drops the stream.
    pollId = window.setInterval(refreshJobs, eventSource ? 10000 : 3000);

    return () => {
      cancelled = true;
      if (pollId) {
        window.clearInterval(pollId);
      }
      eventSource?.close();
    };
  }, [ingestionJobsSupported]);

  async function handleFiles(files) {
    setErrorMessage("");
    try {
      const response = await enqueueKnowledgeFiles(files);
      setLastSubmission(response);
      if (ingestionJobsSupported) {
        const jobsResponse = await fetchIngestionJobs();
        setLiveJobs(Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : []);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  const queueStats = useMemo(
    () => ({
      running: liveJobs.filter((job) => job.status === "Running").length,
      queued: liveJobs.filter((job) => job.status === "Queued").length,
      completed: liveJobs.filter((job) => job.status === "Completed").length,
    }),
    [liveJobs]
  );

  const focusedJob = useMemo(() => {
    return (
      liveJobs.find((job) => job.status === "Running") ||
      liveJobs.find((job) => job.status === "Queued") ||
      liveJobs[0] ||
      null
    );
  }, [liveJobs]);

  const selectedFiles = focusedJob?.selectedFiles || [];
  const logTail = (focusedJob?.logTail || []).slice(-18);
  const dbConfirmation = focusedJob?.dbConfirmation;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Upload & Ingestion"
        title="Realtime ingestion, progress tracing, and Chroma confirmation"
        description="Upload files, watch chunking and embedding in flight, and verify that each selected file is actually queryable from the vector database."
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
            Accepted <strong>{lastSubmission.accepted}</strong> file(s) into <strong>{lastSubmission.targetCollection}</strong>.
            {ingestionJobsSupported
              ? " The live panels below update as the worker validates, chunks, writes, and confirms the upload."
              : ` Cloud Run reported ${lastSubmission.chunksInserted ?? "pending"} inserted chunk(s)${
                  lastSubmission.uploadedToGcs === true ? " and synced the snapshot to GCS." : "."
                }`}
          </p>
        </GlassCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <Workflow className="h-4 w-4" />
              Live pipeline
            </div>
            <StatusPill tone={getStreamTone(streamMode)}>{getStreamLabel(streamMode)}</StatusPill>
          </div>

          {focusedJob ? (
            <div className="mt-4 rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--ai-text)]">{focusedJob.name}</p>
                  <p className="ai-muted mt-1 text-sm">{focusedJob.currentStage || "Queued"}</p>
                </div>
                <StatusPill tone={getJobTone(focusedJob.status)}>{focusedJob.status}</StatusPill>
              </div>
              <div className="mt-4 h-2 rounded-full bg-ai-100/80 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    focusedJob.status === "Failed"
                      ? "bg-gradient-to-r from-rose-500 to-orange-500"
                      : focusedJob.status === "Completed"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                        : "bg-gradient-to-r from-ai-500 to-blue-500"
                  }`}
                  style={{ width: `${Math.max(6, focusedJob.progress || 0)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
                <span>{focusedJob.progress || 0}% complete</span>
                <span>{focusedJob.eta || "Waiting"}</span>
                <span>Updated {formatTimestamp(focusedJob.updatedAt)}</span>
              </div>
              {focusedJob.currentFile ? (
                <p className="mt-3 text-sm text-[var(--ai-text)]">
                  Current file: <strong>{focusedJob.currentFile}</strong>
                </p>
              ) : null}
              {focusedJob.warning ? (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-200">{focusedJob.warning}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-white/50 bg-white/60 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              No ingestion job has been queued yet.
            </div>
          )}

          <div className="mt-5 space-y-4">
            {LIVE_STAGES.map((stage, index) => {
              const stageStatus = getStageStatus(stage.key, focusedJob);
              return (
                <div key={stage.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ai-100 text-ai-700 dark:bg-white/10 dark:text-ai-200">
                      {index + 1}
                    </div>
                    {index < LIVE_STAGES.length - 1 ? <div className="ai-thread-line mt-3 h-16 w-px rounded-full" /> : null}
                  </div>
                  <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-[var(--ai-text)]">{stage.name}</h3>
                      <StatusPill
                        tone={
                          stageStatus === "done"
                            ? "success"
                            : stageStatus === "active"
                              ? "warning"
                              : stageStatus === "failed"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {stageStatus}
                      </StatusPill>
                    </div>
                    <p className="ai-muted mt-2 text-sm">{stage.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

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
            {liveJobs.length ? (
              liveJobs.map((job) => (
                <div key={job.id} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--ai-text)]">{job.name}</h3>
                      <p className="ai-muted mt-1 text-sm">{job.target}</p>
                    </div>
                    <StatusPill tone={getJobTone(job.status)}>{job.status}</StatusPill>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-ai-100/80 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        job.status === "Failed"
                          ? "bg-gradient-to-r from-rose-500 to-orange-500"
                          : job.status === "Completed"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : "bg-gradient-to-r from-ai-500 to-blue-500"
                      }`}
                      style={{ width: `${Math.max(6, job.progress || 0)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300">
                    <span>{job.progress || 0}% complete</span>
                    <span>{job.currentStage || "Queued"}</span>
                    <span>{job.acceptedFiles || job.totalFiles || 0} file(s)</span>
                  </div>
                  {job.summary ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">Chunks inserted</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">{job.summary.chunksInserted}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">Skipped existing</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">{job.summary.chunksSkippedExisting}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">Collection count</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">{job.collectionCount ?? "Pending"}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/50 bg-white/60 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {ingestionJobsSupported
                  ? "The queue is empty. Submit files above to create a live ingest job."
                  : "This web client now talks directly to the production Cloud Run backend, so there is no local ingest queue to poll here."}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Database className="h-4 w-4" />
            Selected files and database proof
          </div>

          {focusedJob ? (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="ai-muted text-sm">Accepted files</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">{focusedJob.acceptedFiles || selectedFiles.length}</p>
                </div>
                <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="ai-muted text-sm">Confirmed in Chroma</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">
                    {dbConfirmation ? `${dbConfirmation.confirmedFiles}/${dbConfirmation.totalFiles}` : "Pending"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="ai-muted text-sm">Confirmed chunks</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">
                    {dbConfirmation ? dbConfirmation.totalConfirmedChunks : "Pending"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {selectedFiles.map((file) => (
                  <div key={`${focusedJob.id}-${file.storageName || file.name}`} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--ai-text)]">{file.name}</h3>
                        <p className="ai-muted mt-1 text-sm">
                          Stored as <strong>{file.storageName}</strong> · {formatBytes(file.sizeBytes || 0)}
                        </p>
                      </div>
                      <StatusPill tone={getFileTone(file)}>{file.status || "Queued"}</StatusPill>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">Chunks created</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">{file.chunksCreated ?? "Pending"}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">Inserted</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">{file.chunksInserted ?? "Pending"}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">DB chunks</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">{file.dbChunkCount ?? "Pending"}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/50 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                        <p className="ai-muted text-xs uppercase tracking-[0.12em]">Presence</p>
                        <p className="mt-2 font-semibold text-[var(--ai-text)]">
                          {file.inVectorDb === true ? "Present in Chroma" : file.inVectorDb === false ? "Missing" : "Pending"}
                        </p>
                      </div>
                    </div>
                    {file.duplicateOf ? (
                      <p className="mt-3 text-sm text-amber-700 dark:text-amber-200">
                        Duplicate of <strong>{file.duplicateOf}</strong>.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {dbConfirmation ? (
                <div className="mt-5 rounded-[24px] border border-white/50 bg-gradient-to-r from-ai-600 to-blue-500 p-5 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Database className="h-4 w-4" />
                    Chroma verification
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/85">
                    Confirmed {dbConfirmation.totalConfirmedChunks} chunk(s) across {dbConfirmation.confirmedFiles} file(s) in
                    {" "}
                    <strong>{dbConfirmation.collectionName}</strong>.
                  </p>
                  <p className="mt-2 break-all text-xs text-white/75">{dbConfirmation.vectorDbPath}</p>
                </div>
              ) : null}
            </>
          ) : !ingestionJobsSupported && lastSubmission ? (
            <div className="mt-5 rounded-[24px] border border-white/50 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/50 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="ai-muted text-sm">Accepted files</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">{lastSubmission.accepted}</p>
                </div>
                <div className="rounded-[24px] border border-white/50 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="ai-muted text-sm">Inserted chunks</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">{lastSubmission.chunksInserted ?? "Pending"}</p>
                </div>
                <div className="rounded-[24px] border border-white/50 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="ai-muted text-sm">Snapshot sync</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--ai-text)]">
                    {lastSubmission.uploadedToGcs === true ? "GCS" : "Pending"}
                  </p>
                </div>
              </div>
              <p className="ai-muted mt-4 text-sm">
                Direct-production mode is active. Uploads are sent straight to the Cloud Run engineering collection.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-white/50 bg-white/60 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Once a job starts, this section will show each selected file, its chunk counts, and whether it is present in the Chroma collection.
            </div>
          )}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="rounded-[32px] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <FileText className="h-4 w-4" />
              Worker output
            </div>
            <div className="mt-5 rounded-[24px] border border-white/50 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 dark:border-white/10">
              {logTail.length ? (
                logTail.map((line, index) => (
                  <div key={`${focusedJob?.id || "logs"}-${index}`} className="break-words">
                    {line}
                  </div>
                ))
              ) : (
                <p className="text-slate-400">
                  {ingestionJobsSupported
                    ? "Worker logs will stream here once ingestion begins."
                    : "Direct-production mode does not expose local worker logs. Upload results are returned by the Cloud Run backend when the request completes."}
                </p>
              )}
            </div>
          </GlassCard>

          <GlassCard className="rounded-[32px] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
              <CloudUpload className="h-4 w-4" />
              Service boundary
            </div>
            <div className="mt-5 space-y-3">
              {apiEndpoints.map((endpoint) => (
                <div key={endpoint.name} className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="font-mono text-sm font-medium text-[var(--ai-text)]">{endpoint.name}</p>
                  <p className="ai-muted mt-2 text-sm">{endpoint.purpose}</p>
                </div>
              ))}
            </div>
            {focusedJob ? (
              <div className="mt-5 rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="ai-muted text-sm">Latest job metadata</p>
                <div className="mt-3 space-y-2 text-sm text-[var(--ai-text)]">
                  <p>Created: {formatTimestamp(focusedJob.createdAt)}</p>
                  <p>Started: {formatTimestamp(focusedJob.startedAt)}</p>
                  <p>Finished: {formatTimestamp(focusedJob.completedAt || focusedJob.workerFinishedAt)}</p>
                  <p>Duration: {focusedJob.durationSeconds ? `${focusedJob.durationSeconds}s` : "Pending"}</p>
                </div>
              </div>
            ) : null}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
