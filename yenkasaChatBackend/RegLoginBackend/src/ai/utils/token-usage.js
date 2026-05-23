function estimateTokens(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function estimateUsage({ prompt, answer, sources = [] }) {
  const promptTokens = estimateTokens(prompt) + estimateTokens(JSON.stringify(sources));
  const completionTokens = estimateTokens(answer);
  const totalTokens = promptTokens + completionTokens;
  const estimatedCostUsd = Number(((promptTokens * 0.00000035) + (completionTokens * 0.00000105)).toFixed(6));

  return {
    estimatedPromptTokens: promptTokens,
    estimatedCompletionTokens: completionTokens,
    estimatedTotalTokens: totalTokens,
    estimatedCostUsd
  };
}

module.exports = {
  estimateTokens,
  estimateUsage
};
