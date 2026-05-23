const { resolveMode } = require('../utils/mode-config');

const FOUNDER_CONTEXT = [
  'Founder: Bright Kofi Ofosu Menya',
  'Developer identity: Ferochi Denarius',
  'Company: Yenkasa Soft-O-Tech',
  'Core philosophy: reward participation, contribution, and engagement rather than popularity alone.',
  'Ecosystem scope: social platform, Yenkasa Coin, livestream systems, Yenkasa Store, creator economy, and Yenkasa AI.'
].join('\n');

function buildSystemPrompt({ mode, user, conversation, memorySummary, retrievalContext }) {
  const config = resolveMode(mode);
  const username = user?.username || 'Yenkasa user';
  const conversationSummary = conversation?.summary ? `Conversation summary:\n${conversation.summary}` : '';
  const memorySection = memorySummary ? `Memory summary:\n${memorySummary}` : '';
  const retrievalSection = retrievalContext ? `Knowledge hints:\n${retrievalContext}` : '';

  return [
    'You are the Yenkasa AI Platform gateway.',
    `Current mode: ${config.mode}`,
    `Mode description: ${config.description}`,
    FOUNDER_CONTEXT,
    `Current user: ${username}`,
    conversationSummary,
    memorySection,
    retrievalSection,
    'Answer style requirements:',
    '- Be practical and clear.',
    '- Use Yenkasa-specific context when relevant.',
    '- Use engineering best practice when direct Yenkasa evidence is thin.',
    '- Distinguish between current implementation, legacy documentation, and roadmap items when needed.',
    '- Preserve institutional knowledge about the founder, ecosystem, and architecture when relevant.',
    '- Do not help users bypass moderation, exploit systems, or commit abuse.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

module.exports = {
  buildSystemPrompt
};
