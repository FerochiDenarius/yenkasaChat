class InsightCardData {
  const InsightCardData({
    required this.title,
    required this.description,
    required this.icon,
  });

  final String title;
  final String description;
  final int icon;
}

class ModuleCardData {
  const ModuleCardData({
    required this.title,
    required this.subtitle,
    required this.tag,
  });

  final String title;
  final String subtitle;
  final String tag;
}

class MetricData {
  const MetricData({
    required this.label,
    required this.value,
    required this.note,
  });

  final String label;
  final String value;
  final String note;
}

class QueueItemData {
  const QueueItemData({
    required this.title,
    required this.owner,
    required this.reason,
    required this.action,
    required this.risk,
  });

  final String title;
  final String owner;
  final String reason;
  final String action;
  final double risk;
}

class JobStageData {
  const JobStageData({
    required this.name,
    required this.status,
    required this.detail,
  });

  final String name;
  final String status;
  final String detail;
}

const landingFeatures = <InsightCardData>[
  InsightCardData(
    title: 'AI Moderation',
    description:
        'Detect risky posts, livestream toxicity, and coordinated abuse before they spread.',
    icon: 0xe3af,
  ),
  InsightCardData(
    title: 'Smart Recommendations',
    description:
        'Rank creators, communities, and engineering answers with context-aware relevance signals.',
    icon: 0xe838,
  ),
  InsightCardData(
    title: 'Livestream Intelligence',
    description:
        'Monitor moderation spikes, audience health, and realtime socket behavior during live events.',
    icon: 0xe03e,
  ),
  InsightCardData(
    title: 'Personalized Feed',
    description:
        'Connect feed retrieval, moderation, and engagement signals into one AI ranking layer.',
    icon: 0xe88a,
  ),
  InsightCardData(
    title: 'AI Chat Support',
    description:
        'Give internal teams a RAG assistant for architecture audits, moderation questions, and ops support.',
    icon: 0xe0bf,
  ),
];

const benefitCards = <InsightCardData>[
  InsightCardData(
    title: 'Safer Community',
    description:
        'Realtime moderation protects discussions, livestreams, and communities from harmful behavior.',
    icon: 0xe8f4,
  ),
  InsightCardData(
    title: 'Better Engagement',
    description:
        'Recommendation and retrieval layers keep users in the right conversations longer.',
    icon: 0xe6df,
  ),
  InsightCardData(
    title: 'Scalable Platform',
    description:
        'A shared AI operating layer reduces manual moderation and speeds up product iteration.',
    icon: 0xe2bd,
  ),
  InsightCardData(
    title: 'Data-Driven Growth',
    description:
        'Latency, retrieval, and content health metrics become visible to engineering and operations.',
    icon: 0xe1b8,
  ),
  InsightCardData(
    title: 'Unique Advantage',
    description:
        'YenkasaAI becomes reusable infrastructure for future APIs, assistants, and moderation products.',
    icon: 0xeb8c,
  ),
];

const platformModules = <ModuleCardData>[
  ModuleCardData(
    title: 'Yenkasa App',
    subtitle: 'Smarter, safer, more engaging social platform',
    tag: 'Platform',
  ),
  ModuleCardData(
    title: 'AI Moderation API',
    subtitle:
        'Moderation decisions, scoring, and alerts for internal and external apps',
    tag: 'API',
  ),
  ModuleCardData(
    title: 'AI Chatbot & Assistant',
    subtitle:
        'Engineering, moderation, and support copilots grounded on Yenkasa knowledge',
    tag: 'Assistant',
  ),
  ModuleCardData(
    title: 'Content Intelligence',
    subtitle:
        'Trend extraction, creator insights, retrieval analytics, and content classification',
    tag: 'Insights',
  ),
  ModuleCardData(
    title: 'Other Projects',
    subtitle:
        'Shared infrastructure for future products built on the same AI operating layer',
    tag: 'Ecosystem',
  ),
];

const poweredBy = <MetricData>[
  MetricData(label: 'Vertex AI', value: 'Gemini', note: 'Generation'),
  MetricData(label: 'LangChain', value: 'RAG', note: 'Orchestration'),
  MetricData(label: 'Vector DB', value: 'Chroma', note: 'Collections'),
  MetricData(label: 'Cloud', value: 'GCP', note: 'Managed inference'),
];

const promptSuggestions = <String>[
  'What is Yenkasa Coin and how do I earn it?',
  'How does verification work on Yenkasa?',
  'What is Yenkasa Live Arena?',
  'What are the ranks in Yenkasa?',
];

const engineeringSuggestions = <String>[
  'How do we scale livestream comments without duplicating socket fan-out?',
  'What are the main technical debt risks in the Android chat client?',
  'Summarize moderation flows across posts, livestreams, and community reports.',
];

const moderationMetrics = <MetricData>[
  MetricData(label: 'High-Risk Posts', value: '27', note: '+9 today'),
  MetricData(label: 'Livestream Alerts', value: '6', note: '2 critical'),
  MetricData(
    label: 'Auto-Resolved',
    value: '84%',
    note: 'Decision confidence 0.91',
  ),
  MetricData(label: 'Moderator Queue', value: '18', note: 'Average SLA 7m'),
];

const moderationQueue = <QueueItemData>[
  QueueItemData(
    title: 'Community stream flagged for hate speech burst',
    owner: 'Yenkasa Farming Hub',
    reason: 'Audio transcript + rapid comment escalation',
    action: 'Escalate and silence host mic',
    risk: 0.94,
  ),
  QueueItemData(
    title: 'Sponsored post likely misleading',
    owner: 'Advertiser Review Queue',
    reason: 'Pricing mismatch against landing page copy',
    action: 'Hold for manual review',
    risk: 0.82,
  ),
  QueueItemData(
    title: 'Group chat flood detected',
    owner: 'Android engineering',
    reason: 'Repeated laugh-reaction bursts',
    action: 'Throttle reactions, warn room owner',
    risk: 0.67,
  ),
];

const analyticsMetrics = <MetricData>[
  MetricData(label: 'AI Requests', value: '18.4k', note: '+12.6%'),
  MetricData(label: 'Median Gemini Latency', value: '1.9s', note: '-180ms'),
  MetricData(label: 'Vector Cache Hit', value: '71%', note: '+5.4%'),
  MetricData(label: 'Active Sources', value: '38 docs', note: '+6'),
];

const ingestionStages = <JobStageData>[
  JobStageData(
    name: 'Validate files',
    status: 'done',
    detail: 'PDF corruption and duplicate checks',
  ),
  JobStageData(
    name: 'Split into chunks',
    status: 'active',
    detail: 'Adaptive chunking for architecture docs',
  ),
  JobStageData(
    name: 'Generate embeddings',
    status: 'queued',
    detail: 'HuggingFace now, Gemini-ready next',
  ),
  JobStageData(
    name: 'Persist to Chroma',
    status: 'queued',
    detail: 'Stable collection writes and metrics',
  ),
];
