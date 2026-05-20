import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, Database, Send, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import AnswerCard from "../../components/ai/AnswerCard";
import ChatMessageBubble from "../../components/ai/ChatMessageBubble";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import SourceCard from "../../components/ai/SourceCard";
import StatCard from "../../components/ai/StatCard";
import { chatPrompts } from "../../services/ai/mockData";
import { queryAssistant } from "../../services/ai/platformService";

const AUDIENCE_CONFIG = {
  public: {
    label: "Public Assistant",
    intro:
      "YenkasaAI is online. Ask about YKC, ranks, verification, communities, Live Arena, creator growth, or user safety.",
    title: "Platform answers grounded on Yenkasa knowledge",
    description:
      "This mode is designed for normal users. It explains product concepts naturally, avoids internal engineering detail, and keeps moderation-sensitive topics safe.",
    placeholder: "Ask what Yenkasa Coin is, how ranks work, or what Live Arena means",
    prompts: [
      "What is Yenkasa Coin and how do I earn it?",
      "How does verification work on Yenkasa?",
      "What is Yenkasa Live Arena?",
      "What are the ranks in Yenkasa?",
    ],
    profile: [
      "Answers are shaped for normal users and product understanding.",
      "Public retrieval is separated from the engineering collection.",
      "Safety filtering avoids moderation-bypass and exploit guidance.",
    ],
  },
  engineering: {
    label: "Engineering Copilot",
    intro:
      "YenkasaAI is online. Ask about distributed systems, livestream scaling, moderation pipelines, mobile stability, or ingestion architecture.",
    title: "Engineering answers grounded on Yenkasa knowledge",
    description:
      "The engineering mode stays focused on distributed systems, livestream scale, moderation workflows, mobile optimization, and AI infrastructure decisions.",
    placeholder: "Ask about Socket.IO bottlenecks, moderation flows, Android lifecycle risks, or ingestion strategy",
    prompts: chatPrompts,
    profile: [
      "Vertex AI generation runs over the engineering research collection.",
      "Chroma retrieval remains isolated from the public knowledge collection.",
      "Answers are shaped for architecture and operational decisions.",
    ],
  },
};

function buildInitialMessages(audience) {
  return [
    {
      id: "m-1",
      role: "assistant",
      content: AUDIENCE_CONFIG[audience].intro,
    },
  ];
}

export default function AiChatDashboardPage() {
  const [audience, setAudience] = useState("public");
  const [messages, setMessages] = useState(buildInitialMessages("public"));
  const [question, setQuestion] = useState(AUDIENCE_CONFIG.public.prompts[0]);
  const [loading, setLoading] = useState(false);
  const [resultMeta, setResultMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const chatThreadRef = useRef(null);

  function switchAudience(nextAudience) {
    setAudience(nextAudience);
    setMessages(buildInitialMessages(nextAudience));
    setQuestion(AUDIENCE_CONFIG[nextAudience].prompts[0]);
    setResultMeta(null);
    setErrorMessage("");
  }

  useEffect(() => {
    const thread = chatThreadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, loading]);

  async function submitQuestion() {
    const nextQuestion = question.trim();
    if (!nextQuestion || loading) return;

    const nextMessages = [...messages, { id: crypto.randomUUID(), role: "user", content: nextQuestion }];
    setMessages(nextMessages);
    setQuestion("");
    setErrorMessage("");
    setLoading(true);

    try {
      const response = await queryAssistant({ question: nextQuestion, history: nextMessages, audience });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
        },
      ]);
      setResultMeta(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "YenkasaAI request failed.";
      setErrorMessage(message);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `YenkasaAI could not answer that request right now.\n\nError: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitQuestion();
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion();
    }
  }

  const chatMetrics = useMemo(
    () => [
      {
        label: "Mode",
        value: AUDIENCE_CONFIG[audience].label,
        note: resultMeta ? `${resultMeta.audience} retrieval` : "Audience-scoped retrieval",
      },
      {
        label: "Retrieval",
        value: resultMeta ? `${resultMeta.timings.retrievalMs}ms` : "412ms",
        note: resultMeta?.audience === "public" ? "Platform knowledge search" : "Engineering Chroma search",
      },
      {
        label: "Latency",
        value: resultMeta ? `${resultMeta.timings.totalMs}ms` : "1.9s",
        note: resultMeta ? resultMeta.model : "gemini-2.5-flash",
      },
    ],
    [audience, resultMeta]
  );

  const currentConfig = AUDIENCE_CONFIG[audience];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
      <div className="space-y-6">
        <SectionHeading
          eyebrow="AI Chat Dashboard"
          title={currentConfig.title}
          description={currentConfig.description}
        />

        <div className="flex flex-wrap gap-2">
          {Object.entries(AUDIENCE_CONFIG).map(([key, config]) => {
            const active = key === audience;
            return (
              <button
                key={key}
                type="button"
                onClick={() => switchAudience(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-gradient-to-r from-ai-600 to-blue-500 text-white shadow-glow"
                    : "border border-white/50 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {chatMetrics.map((metric) => (
            <StatCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} />
          ))}
        </div>

        <GlassCard className="rounded-[32px] p-5 sm:p-6" strong>
          {errorMessage ? (
            <div className="mb-4 rounded-[24px] border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
              {errorMessage}
            </div>
          ) : null}
          <div ref={chatThreadRef} className="ai-scroll flex max-h-[560px] flex-col gap-4 overflow-y-auto pr-1">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} role={message.role}>
                {message.content}
              </ChatMessageBubble>
            ))}

            {loading ? (
              <motion.div initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="max-w-3xl">
                <GlassCard className="rounded-[24px] p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
                    <Sparkles className="h-4 w-4" />
                    YenkasaAI
                  </div>
                  <div className="flex gap-2">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ai-500" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ai-400 [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400 [animation-delay:240ms]" />
                  </div>
                </GlassCard>
              </motion.div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 rounded-[28px] border border-white/50 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <label htmlFor="ai-chat-input" className="sr-only">
              Ask YenkasaAI
            </label>
            <textarea
              id="ai-chat-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={currentConfig.placeholder}
              rows={4}
              className="w-full resize-none border-0 bg-transparent text-sm leading-7 text-[var(--ai-text)] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {currentConfig.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-full border border-white/50 bg-white/85 px-3 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    onClick={() => setQuestion(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-ai-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {loading ? "Thinking..." : "Send to YenkasaAI"}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>

      <div className="space-y-6">
        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <ShieldCheck className="h-4 w-4" />
            Answer cards
          </div>
          <div className="mt-5 space-y-4">
            {(resultMeta?.answerCards || []).map((card) => (
              <AnswerCard key={`${card.category}-${card.title}`} card={card} />
            ))}
            {!resultMeta ? (
              <p className="ai-muted text-sm leading-7">
                High-signal answer cards will appear here after the first query so users can scan the main points quickly.
              </p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6" strong>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Database className="h-4 w-4" />
            Sources used
          </div>
          <div className="mt-5 space-y-4">
            {(resultMeta?.sources || []).map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
            {!resultMeta ? (
              <p className="ai-muted text-sm leading-7">
                Source attribution will appear here after the first query, with citations and retrieval score indicators.
              </p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Waypoints className="h-4 w-4" />
            Suggested follow-ups
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(resultMeta?.suggestedFollowUps || currentConfig.prompts).map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-white/50 bg-white/85 px-3 py-2 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                onClick={() => setQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Clock3 className="h-4 w-4" />
            Latency profile
          </div>
          <div className="mt-5 grid gap-4">
            <div className="rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="ai-muted">Retrieval</span>
                <span className="font-semibold text-[var(--ai-text)]">
                  {resultMeta ? `${resultMeta.timings.retrievalMs}ms` : "Awaiting query"}
                </span>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="ai-muted">Generation</span>
                <span className="font-semibold text-[var(--ai-text)]">
                  {resultMeta ? `${resultMeta.timings.generationMs}ms` : "Awaiting query"}
                </span>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="ai-muted">Total</span>
                <span className="font-semibold text-[var(--ai-text)]">
                  {resultMeta ? `${resultMeta.timings.totalMs}ms` : "Awaiting query"}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[32px] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:text-ai-200">
            <Sparkles className="h-4 w-4" />
            Response profile
          </div>
          <ul className="mt-5 space-y-4 text-sm leading-7">
            {currentConfig.profile.map((item) => (
              <li
                key={item}
                className="rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
              >
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
