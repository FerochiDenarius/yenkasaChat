export const aiFeatures = [
  {
    title: "AI Moderation",
    description: "Detect risky posts, livestream toxicity, and coordinated abuse before they spread.",
    icon: "shield",
  },
  {
    title: "Smart Recommendations",
    description: "Rank creators, communities, and engineering answers with context-aware relevance signals.",
    icon: "sparkles",
  },
  {
    title: "Livestream Intelligence",
    description: "Monitor moderation spikes, audience health, and realtime socket behavior during live events.",
    icon: "radio",
  },
  {
    title: "Personalized Feed",
    description: "Connect feed retrieval, moderation, and engagement signals into one AI ranking layer.",
    icon: "orbit",
  },
  {
    title: "AI Chat Support",
    description: "Give internal teams a RAG assistant for architecture audits, moderation questions, and ops support.",
    icon: "messages",
  },
];

export const benefitCards = [
  {
    title: "Safer Community",
    description: "Realtime moderation protects discussions, livestreams, and communities from harmful behavior.",
  },
  {
    title: "Better Engagement",
    description: "Recommendation and retrieval layers keep users in the right conversations longer.",
  },
  {
    title: "Scalable Platform",
    description: "A shared AI operating layer reduces manual moderation and speeds up product iteration.",
  },
  {
    title: "Data-Driven Growth",
    description: "Latency, retrieval, and content health metrics become visible to engineering and operations.",
  },
  {
    title: "Unique Advantage",
    description: "YenkasaAI becomes reusable infrastructure for future APIs, assistants, and moderation products.",
  },
];

export const platformModules = [
  {
    title: "Yenkasa App",
    subtitle: "Smarter, safer, more engaging social platform",
    tag: "Platform",
  },
  {
    title: "AI Moderation API",
    subtitle: "Moderation decisions, scoring, and alerts for internal and external apps",
    tag: "API",
  },
  {
    title: "AI Chatbot & Assistant",
    subtitle: "Engineering, moderation, and support copilots grounded on Yenkasa knowledge",
    tag: "Assistant",
  },
  {
    title: "Content Intelligence",
    subtitle: "Trend extraction, creator insights, retrieval analytics, and content classification",
    tag: "Insights",
  },
  {
    title: "Other Projects",
    subtitle: "Shared infrastructure for future products built on the same AI operating layer",
    tag: "Ecosystem",
  },
];

export const poweredBy = [
  { label: "Vertex AI", detail: "Gemini generation" },
  { label: "LangChain", detail: "RAG orchestration" },
  { label: "Vector DB", detail: "Chroma collections" },
  { label: "Cloud (GCP)", detail: "Managed inference" },
];

export const sourceDocuments = [
  {
    id: "src-1",
    title: "SOCKET_IO_REALTIME_SYSTEM.md",
    area: "Realtime",
    score: 0.97,
    chunks: 14,
    freshness: "Updated 2h ago",
    excerpt: "Socket.IO events still fan out through a single Node process, with room membership held in process-local maps.",
  },
  {
    id: "src-2",
    title: "LIVESTREAM_ARCHITECTURE.md",
    area: "Livestream",
    score: 0.94,
    chunks: 11,
    freshness: "Updated 1d ago",
    excerpt: "Agora channel joins depend on backend-issued tokens plus socket-driven participant synchronization.",
  },
  {
    id: "src-3",
    title: "ANDROID_FRONTEND_ARCHITECTURE.md",
    area: "Android",
    score: 0.89,
    chunks: 18,
    freshness: "Updated 1d ago",
    excerpt: "ChatActivity and LiveStreamActivity remain oversized orchestration points with lifecycle pressure.",
  },
];

export const chatPrompts = [
  "How do we scale livestream comments without duplicating socket fan-out?",
  "What are the main technical debt risks in the Android chat client?",
  "Summarize moderation flows across posts, livestreams, and community reports.",
];

export const knowledgeCategories = [
  { name: "Backend Architecture", files: 8, chunks: 62, health: "Healthy" },
  { name: "Livestream", files: 4, chunks: 31, health: "Watch socket scale" },
  { name: "Moderation", files: 5, chunks: 38, health: "Healthy" },
  { name: "Rewards / YKC", files: 3, chunks: 19, health: "Needs more docs" },
  { name: "Feed System", files: 5, chunks: 34, health: "Healthy" },
  { name: "AI Research", files: 13, chunks: 68, health: "Mixed corpus" },
];

export const knowledgeDocuments = [
  {
    name: "SYSTEM_OVERVIEW.pdf",
    category: "Backend Architecture",
    chunks: 9,
    lastIngested: "Today, 10:21",
    status: "Indexed",
  },
  {
    name: "WEB_FRONTEND_ARCHITECTURE.pdf",
    category: "AI Research",
    chunks: 6,
    lastIngested: "Today, 10:24",
    status: "Indexed",
  },
  {
    name: "LIVESTREAM_CLIENT_ARCHITECTURE.pdf",
    category: "Livestream",
    chunks: 7,
    lastIngested: "Today, 10:24",
    status: "Indexed",
  },
  {
    name: "MODERATION_FLOW.pdf",
    category: "Moderation",
    chunks: 5,
    lastIngested: "Today, 10:21",
    status: "Indexed",
  },
];

export const vectorStats = [
  { label: "Collections", value: "3", note: "Yenkasa internal, research, mixed" },
  { label: "Indexed Chunks", value: "252", note: "Current active corpus" },
  { label: "Median Retrieval", value: "412ms", note: "Top-k search" },
  { label: "Embedding Backend", value: "HuggingFace", note: "Gemini-ready migration path" },
];

export const moderationMetrics = [
  { title: "High-Risk Posts", value: "27", delta: "+9 today", tone: "danger" },
  { title: "Livestream Alerts", value: "6", delta: "2 critical", tone: "warning" },
  { title: "Auto-Resolved", value: "84%", delta: "Decision confidence 0.91", tone: "success" },
  { title: "Moderator Queue", value: "18", delta: "Average SLA 7m", tone: "neutral" },
];

export const moderationQueue = [
  {
    id: "mod-1",
    title: "Community stream flagged for hate speech burst",
    owner: "Yenkasa Farming Hub",
    risk: 0.94,
    reason: "Audio transcript + rapid comment escalation",
    action: "Escalate and silence host mic",
  },
  {
    id: "mod-2",
    title: "Sponsored post likely misleading",
    owner: "Advertiser Review Queue",
    risk: 0.82,
    reason: "Pricing mismatch against landing page copy",
    action: "Hold for manual review",
  },
  {
    id: "mod-3",
    title: "Group chat flood detected",
    owner: "Android engineering",
    risk: 0.67,
    reason: "Repeated laugh-reaction bursts",
    action: "Throttle reactions, warn room owner",
  },
];

export const moderationAlerts = [
  "Socket room join rate spiked 42% during current livestream.",
  "Three creator accounts are approaching high-risk moderation thresholds.",
  "OneSignal delivery degraded for comment notifications in the last 15 minutes.",
];

export const analyticsHealth = [
  { label: "AI Requests", value: "18.4k", trend: "+12.6%" },
  { label: "Median Gemini Latency", value: "1.9s", trend: "-180ms" },
  { label: "Vector Cache Hit", value: "71%", trend: "+5.4%" },
  { label: "Active Sources", value: "38 docs", trend: "+6" },
];

export const latencySeries = [
  { label: "00:00", retrieval: 340, generation: 1480 },
  { label: "04:00", retrieval: 390, generation: 1520 },
  { label: "08:00", retrieval: 360, generation: 1670 },
  { label: "12:00", retrieval: 430, generation: 1820 },
  { label: "16:00", retrieval: 470, generation: 1710 },
  { label: "20:00", retrieval: 410, generation: 1580 },
];

export const volumeSeries = [
  { label: "Mon", value: 920 },
  { label: "Tue", value: 1180 },
  { label: "Wed", value: 1310 },
  { label: "Thu", value: 1450 },
  { label: "Fri", value: 1720 },
  { label: "Sat", value: 1260 },
];

export const ingestionStages = [
  { name: "Validate files", status: "done", detail: "PDF corruption and duplicate checks" },
  { name: "Split into chunks", status: "active", detail: "Adaptive chunking for architecture docs" },
  { name: "Generate embeddings", status: "queued", detail: "HuggingFace now, Gemini-ready next" },
  { name: "Persist to Chroma", status: "queued", detail: "Stable collection writes and metrics" },
];

export const ingestionJobs = [
  {
    id: "job-1",
    name: "web_store_docs_batch_04",
    status: "Running",
    progress: 64,
    eta: "2m 10s",
    target: "yenkasa_research",
  },
  {
    id: "job-2",
    name: "android_client_refresh",
    status: "Queued",
    progress: 0,
    eta: "Waiting",
    target: "yenkasa_internal_architecture",
  },
  {
    id: "job-3",
    name: "moderation_research_merge",
    status: "Completed",
    progress: 100,
    eta: "Done",
    target: "mixed moderation corpus",
  },
];

export const apiEndpoints = [
  { name: "POST /api/yenkasa-ai/chat", purpose: "RAG response generation with citations" },
  { name: "POST /api/yenkasa-ai/ingest", purpose: "Knowledge ingestion queue submission" },
  { name: "GET /api/yenkasa-ai/health", purpose: "Bridge health and corpus readiness" },
  { name: "GET /api/yenkasa-ai/ingest/jobs", purpose: "Live ingestion queue state" },
];
