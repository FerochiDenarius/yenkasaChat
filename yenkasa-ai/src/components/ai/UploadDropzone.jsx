import { useRef } from "react";
import { FileUp, FolderArchive } from "lucide-react";
import GlassCard from "./GlassCard";

export default function UploadDropzone({ onFiles }) {
  const inputRef = useRef(null);

  function handleChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      onFiles?.(files);
      event.target.value = "";
    }
  }

  return (
    <GlassCard className="rounded-[32px] p-6 sm:p-8" strong>
      <div className="flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-ai-300/60 bg-white/60 p-8 text-left dark:border-ai-300/20 dark:bg-white/5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-ai-500 to-blue-500 text-white shadow-glow">
          <FileUp className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-[var(--ai-text)]">Upload knowledge into YenkasaAI</h3>
          <p className="ai-muted mt-2 max-w-2xl text-sm leading-6">
            Drag architecture PDFs, moderation docs, or research notes into the ingestion queue. Files are
            sent through the live YenkasaAI bridge and written into the knowledge collection.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-ai-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-glow"
            onClick={() => inputRef.current?.click()}
          >
            <FolderArchive className="h-4 w-4" />
            Select files
          </button>
          <span className="inline-flex items-center rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            PDF, Markdown
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.md"
          className="hidden"
          multiple
          onChange={handleChange}
        />
      </div>
    </GlassCard>
  );
}
