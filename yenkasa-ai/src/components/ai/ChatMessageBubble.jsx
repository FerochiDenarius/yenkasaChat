import { Bot, UserRound } from "lucide-react";
import GlassCard from "./GlassCard";

export default function ChatMessageBubble({ role, children }) {
  const isAssistant = role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <GlassCard
        className={`max-w-3xl p-5 ${isAssistant ? "rounded-tl-md" : "rounded-tr-md bg-gradient-to-br from-ai-600 to-blue-500 text-white"}`}
        strong={isAssistant}
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          {isAssistant ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
          {isAssistant ? "YenkasaAI" : "Operator"}
        </div>
        <div
          className={`whitespace-pre-line text-sm leading-7 sm:text-[15px] ${isAssistant ? "text-[var(--ai-text)]" : "text-white"}`}
        >
          {children}
        </div>
      </GlassCard>
    </div>
  );
}
