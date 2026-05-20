import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Cloud,
  Database,
  MessageSquareText,
  Orbit,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import BrandMark from "../../components/ai/BrandMark";
import GlassCard from "../../components/ai/GlassCard";
import SectionHeading from "../../components/ai/SectionHeading";
import ThemeToggle from "../../components/ai/ThemeToggle";
import { aiFeatures, benefitCards, platformModules, poweredBy } from "../../services/ai/mockData";

const featureIcons = {
  shield: ShieldCheck,
  sparkles: Sparkles,
  radio: RadioTower,
  orbit: Orbit,
  messages: MessageSquareText,
};

export default function AiLandingPage() {
  const { theme, toggleTheme } = useOutletContext();

  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-12 flex flex-col gap-5 rounded-[30px] border border-white/40 bg-white/70 p-5 shadow-glass backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/5">
          <BrandMark />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/ai/chat"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-ai-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-glow"
            >
              Launch YenkasaAI
              <ArrowRight className="h-4 w-4" />
            </Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr_1.05fr]">
          <GlassCard className="rounded-[32px] p-6 xl:p-7" strong>
            <SectionHeading
              eyebrow="How YenkasaAI helps the app"
              title="Platform intelligence for the Yenkasa product surface"
              description="Each capability is mapped to engineering and moderation workflows, not generic chatbot UX."
            />
            <div className="mt-6 grid gap-4">
              {aiFeatures.map((feature) => {
                const Icon = featureIcons[feature.icon];
                return (
                  <div key={feature.title} className="flex items-start gap-4 rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-ai-100 text-ai-700 dark:bg-white/10 dark:text-ai-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--ai-text)]">{feature.title}</h3>
                      <p className="ai-muted mt-1 text-sm leading-6">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <GlassCard className="ai-hero-frame rounded-[36px] p-7 sm:p-8" strong>
              <div className="mb-5 flex items-center gap-3 text-sm font-medium text-ai-700 dark:text-ai-200">
                <BrainCircuit className="h-4 w-4" />
                Building YenkasaAI
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[var(--ai-text)] sm:text-5xl">
                YenkasaAI as an
                {" "}
                <span className="ai-gradient-text">AI operating system</span>
                {" "}
                for moderation, engineering, and platform intelligence.
              </h1>
              <p className="ai-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">
                Inspired by the architecture you shared, this interface turns the same structure into an
                interactive cloud-native dashboard: generation, retrieval, moderation, ingestion, and analytics
                all exposed through one premium control plane.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/ai/chat"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-ai-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-glow"
                >
                  Launch YenkasaAI
                </Link>
                <Link
                  to="/ai/ingestion"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                >
                  Upload Knowledge
                </Link>
                <Link
                  to="/ai/knowledge"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                >
                  Explore APIs
                </Link>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-4">
                {poweredBy.map((item) => {
                  const iconMap = {
                    "Vertex AI": Sparkles,
                    LangChain: Orbit,
                    "Vector DB": Database,
                    "Cloud (GCP)": Cloud,
                  };
                  const Icon = iconMap[item.label] || Bot;
                  return (
                    <div
                      key={item.label}
                      className="rounded-[24px] border border-white/50 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <Icon className="h-5 w-5 text-ai-700 dark:text-ai-200" />
                      <h3 className="mt-3 text-sm font-semibold text-[var(--ai-text)]">{item.label}</h3>
                      <p className="ai-muted mt-1 text-sm">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="rounded-[32px] p-6 sm:p-7">
              <SectionHeading
                eyebrow="Powers more than just Yenkasa"
                title="Shared AI capabilities ready for APIs, copilots, and moderation services"
                description="The same backend knowledge, moderation logic, and analytics surfaces can power multiple products."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {platformModules.map((module) => (
                  <div key={module.title} className="rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="inline-flex rounded-full bg-ai-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ai-700 dark:bg-white/10 dark:text-ai-200">
                      {module.tag}
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-[var(--ai-text)]">{module.title}</h3>
                    <p className="ai-muted mt-2 text-sm leading-6">{module.subtitle}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.section>

          <GlassCard className="rounded-[32px] p-6 xl:p-7" strong>
            <SectionHeading
              eyebrow="Benefits to Yenkasa"
              title="A safer, faster, more measurable platform"
              description="This is where the AI stack becomes an operating advantage, not just a feature."
            />
            <div className="mt-6 grid gap-4">
              {benefitCards.map((benefit, index) => (
                <div key={benefit.title} className="flex items-start gap-4 rounded-[24px] border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-ai-500 to-blue-500 text-white">
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ai-text)]">{benefit.title}</h3>
                    <p className="ai-muted mt-1 text-sm leading-6">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="mt-8">
          <GlassCard className="rounded-[30px] p-6 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ai-700 dark:text-ai-200">Mission</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ai-text)]">
                  Use AI to build a better Yenkasa, help creators grow, protect communities, and power the next generation of products.
                </h2>
              </div>
              <div className="rounded-[24px] border border-white/50 bg-gradient-to-r from-white/90 to-ai-50 p-5 dark:border-white/10 dark:from-white/5 dark:to-ai-500/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ai-500 to-blue-500 text-white">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-semibold">
                      <span>Yenkasa</span>
                      <span className="ai-gradient-text">AI</span>
                    </div>
                    <p className="ai-muted text-sm">Smarter technology. Stronger community. Endless possibilities.</p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>
      </div>
    </div>
  );
}
