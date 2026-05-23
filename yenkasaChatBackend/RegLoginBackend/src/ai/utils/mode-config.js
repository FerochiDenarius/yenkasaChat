const MODE_CONFIGS = {
  general: {
    mode: 'general',
    audience: 'public',
    retrievalAudiences: ['public', 'engineering'],
    provider: 'fastapi_rag',
    description: 'General product and ecosystem assistance with best-practice reasoning.',
    suggestions: [
      'What makes Yenkasa different from other social platforms?',
      'How should we improve the current user onboarding flow?',
      'What are the biggest risks in the current architecture?'
    ]
  },
  engineering: {
    mode: 'engineering',
    audience: 'engineering',
    retrievalAudiences: ['engineering', 'public'],
    provider: 'fastapi_rag',
    description: 'System design, backend, mobile, AI, and scaling analysis.',
    suggestions: [
      'Is the current backend scalable enough for livestream growth?',
      'Which services should split out of the monolith first?',
      'How should Yenkasa approach Redis and event-driven coordination?'
    ]
  },
  yenkasa: {
    mode: 'yenkasa',
    audience: 'public',
    retrievalAudiences: ['public'],
    provider: 'fastapi_rag',
    description: 'Yenkasa ecosystem, roadmap, founder story, and platform guidance.',
    suggestions: [
      'Who created Yenkasa and why?',
      'How does Yenkasa verification work?',
      'What is Yenkasa Coin used for?'
    ]
  },
  hybrid: {
    mode: 'hybrid',
    audience: 'public',
    retrievalAudiences: ['public', 'engineering'],
    provider: 'fastapi_rag',
    description: 'Combined Yenkasa knowledge and engineering reasoning.',
    suggestions: [
      'Compare Yenkasa architecture with industry standards.',
      'How does Yenkasa AI combine retrieval and reasoning now?',
      'What should be improved first in the current ecosystem?'
    ]
  },
  moderation: {
    mode: 'moderation',
    audience: 'engineering',
    retrievalAudiences: ['engineering', 'public'],
    provider: 'fastapi_rag',
    description: 'Safety, abuse response, moderation tooling, and policy-aware guidance.',
    suggestions: [
      'How should moderation workflows scale across posts and livestreams?',
      'What signals should trigger manual review?',
      'How can Yenkasa improve creator safety without heavy friction?'
    ]
  },
  creator_assistant: {
    mode: 'creator_assistant',
    audience: 'public',
    retrievalAudiences: ['public', 'engineering'],
    provider: 'fastapi_rag',
    description: 'Creator growth, monetization, content strategy, and ecosystem navigation.',
    suggestions: [
      'How can creators grow faster inside Yenkasa?',
      'How do ads, rewards, and visibility connect?',
      'How should Yenkasa Live help creator monetization?'
    ]
  }
};

function resolveMode(inputMode) {
  const normalized = String(inputMode || 'hybrid').trim().toLowerCase();
  return MODE_CONFIGS[normalized] || MODE_CONFIGS.hybrid;
}

function listModes() {
  return Object.values(MODE_CONFIGS);
}

module.exports = {
  MODE_CONFIGS,
  resolveMode,
  listModes
};
