import { BrainCircuit } from "lucide-react";

export default function BrandMark({ compact = false }) {
  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-4"}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ai-500 via-ai-600 to-blue-500 text-white shadow-glow">
        <BrainCircuit className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className={`font-semibold tracking-tight ${compact ? "text-base" : "text-xl"}`}>
          <span>Yenkasa</span>
          <span className="ai-gradient-text">AI</span>
        </div>
        <p className="ai-subtle text-sm">
          {compact ? "Engineering intelligence" : "Moderation, retrieval, and platform intelligence"}
        </p>
      </div>
    </div>
  );
}
