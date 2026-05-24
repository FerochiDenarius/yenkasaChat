import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Search, ArrowRight, Database, ShieldCheck } from "lucide-react";
import { YmeBadge, YmeCard, YmeCardHeader, YmeEmptyState } from "../../components/yme/YmePrimitives";
import { useYmeInspector } from "../../services/yme/useYmeInspector";
import { fetchYmeRetrievalInspect } from "../../services/yme/ymeApi";
import { formatCount, formatDate, formatDuration, formatPercent, safeArray } from "../../services/yme/ymeHelpers";

export default function YmeRetrievalsPage() {
  const { refreshSignal } = useOutletContext() || {};
  const [userIdInput, setUserIdInput] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [probe, setProbe] = useState({ userId: "", query: "" });
  const [probeResult, setProbeResult] = useState(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState("");
  const { data, loading, error } = useYmeInspector({ userId: probe.userId, query: probe.query, limit: 25, refreshSignal });

  const overview = data || {};
  const retrievalQuality = overview.retrievalQuality || overview.userInspection?.retrievalQuality || {};
  const matches = safeArray(overview.userInspection?.retrieval?.matches || retrievalQuality.matches);
  const embeddings = safeArray(overview.recentEmbeddings);
  const failedEmbeddings = safeArray(overview.failedEmbeddings);
  const query = overview.userInspection?.query || probe.query;

  const handleInspect = async () => {
    if (!userIdInput.trim()) {
      setProbeError("A user ID is required for retrieval inspection.");
      return;
    }

    try {
      setProbeLoading(true);
      setProbeError("");
      const result = await fetchYmeRetrievalInspect({
        userId: userIdInput.trim(),
        query: queryInput.trim(),
        limit: 12,
      });
      setProbeResult(result);
      setProbe({ userId: userIdInput.trim(), query: queryInput.trim() });
    } catch (inspectError) {
      setProbeError(inspectError.message || "Failed to inspect retrieval.");
    } finally {
      setProbeLoading(false);
    }
  };

  const qualityTiles = useMemo(
    () => [
      { label: "Quality score", value: formatPercent(retrievalQuality.retrievalQualityScore || 0) },
      { label: "Relevance", value: formatPercent(retrievalQuality.retrievedMemoryRelevance || 0) },
      { label: "Latency", value: formatDuration(retrievalQuality.retrievalLatencyMs || 0) },
      { label: "Duplicates", value: formatCount(retrievalQuality.duplicateRetrievalCount || 0) },
      { label: "Stale", value: formatCount(retrievalQuality.staleRetrievalCount || 0) },
      { label: "Low quality", value: formatCount(retrievalQuality.lowQualityRetrievalCount || 0) },
    ],
    [retrievalQuality],
  );

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">Retrieval debugger</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Memory retrieval analysis</h1>
          <p className="mt-2 text-sm text-slate-400">Probe a user’s memory surface and validate retrieval quality before expanding the signal set.</p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
          Back to overview <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <YmeCard className="p-5" strong>
        <YmeCardHeader title="Retrieval probe" subtitle="Enter a user ID and optional query to inspect the retrieved memories." />
        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">User ID</p>
            <input value={userIdInput} onChange={(event) => setUserIdInput(event.target.value)} placeholder="Mongo ObjectId" className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Query</p>
            <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="football skills tutorial" className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          </div>
          <button type="button" onClick={handleInspect} className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(124,58,237,0.3)]">
            <Search className="h-4 w-4" />
            {probeLoading ? "Inspecting..." : "Inspect"}
          </button>
        </div>
        {probeError ? <p className="mt-3 text-sm text-rose-200">{probeError}</p> : null}
      </YmeCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {qualityTiles.map((tile) => (
          <div key={tile.label} className="rounded-[22px] border border-white/10 bg-[rgba(20,23,38,0.88)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{tile.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <YmeCard className="p-5">
          <YmeCardHeader title="Retrieved memories" subtitle={query ? `Query: ${query}` : "No retrieval query submitted yet."} />
          <div className="mt-4 space-y-3">
            {matches.length ? matches.slice(0, 10).map((match, index) => (
              <div key={match.sourceId || index} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{match.title || match.sourceType || "memory"}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{match.reason || match.text || match.summary || "No detail available."}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400">
                    <span>Similarity {formatPercent(match.retrievalScore || 0)}</span>
                    <span>Importance {formatPercent(match.importance || 0)}</span>
                  </div>
                </div>
              </div>
            )) : <YmeEmptyState title="No retrieval matches" description="Run a probe to inspect the memory ranking output for this user." />}
          </div>
        </YmeCard>

        <YmeCard className="p-5">
          <YmeCardHeader title="Embedding status" subtitle="Current embeddings and inspection failures." />
          <div className="mt-4 space-y-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recent embeddings</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCount(embeddings.length)}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Failed embeddings</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCount(failedEmbeddings.length)}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Last retrieval latency</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatDuration(retrievalQuality.retrievalLatencyMs || 0)}</p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Memory quality</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(retrievalQuality.retrievalQualityScore || 0)}</p>
            </div>
          </div>
        </YmeCard>
      </div>

      {probeResult ? (
        <YmeCard className="p-5">
          <YmeCardHeader title="Probe result" subtitle="Direct response from the retrieval inspection endpoint." />
          <pre className="mt-4 overflow-auto rounded-[20px] border border-white/10 bg-black/30 p-4 text-xs leading-6 text-slate-300">{JSON.stringify(probeResult.inspection || probeResult, null, 2)}</pre>
        </YmeCard>
      ) : null}

      {error ? <YmeCard className="border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">Failed to load retrieval data: {error}</YmeCard> : null}
      {loading ? <YmeCard className="p-4 text-sm text-slate-300">Loading retrieval inspector data...</YmeCard> : null}
    </div>
  );
}
