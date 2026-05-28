const { GoogleAuth } = require('google-auth-library');

const { getYmeConfig } = require('../config/yme.config');
const { normalizeText } = require('../utils/textNormalizer');
const { incrementCounter, recordDuration } = require('./metrics.service');

let authClientPromise = null;
let lastEmbeddingRequestAt = 0;
let embeddingGate = Promise.resolve();

function getEmbeddingEndpoint() {
  const config = getYmeConfig();
  return `https://${config.embedding.location}-aiplatform.googleapis.com/v1/projects/${config.embedding.projectId}/locations/${config.embedding.location}/publishers/google/models/${config.embedding.modelId}:predict`;
}

function isEmbeddingEnabled() {
  const config = getYmeConfig();
  return Boolean(config.embedding.enabled && config.embedding.projectId);
}

async function getAuthClient() {
  if (!authClientPromise) {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    authClientPromise = auth.getClient();
  }
  return authClientPromise;
}

function chunkItems(items = [], size = 1) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildEmbeddingInstance(item = {}) {
  const normalizedText = normalizeText(item?.text || '');
  if (!normalizedText) {
    throw new Error('Text is required to generate embeddings.');
  }
  return {
    content: normalizedText,
    task_type: item.taskType || 'RETRIEVAL_DOCUMENT',
    ...(item.title ? { title: normalizeText(item.title || '') } : {}),
  };
}

async function waitForEmbeddingSlot() {
  if (!isEmbeddingEnabled()) {
    const error = new Error('YME embeddings are not configured.');
    error.code = 'YME_EMBEDDINGS_DISABLED';
    throw error;
  }

  const config = getYmeConfig();
  const previous = embeddingGate;
  let release;
  embeddingGate = new Promise((resolve) => {
    release = resolve;
  });

  await previous;
  const waitMs = Math.max(0, config.embedding.minRequestIntervalMs - (Date.now() - lastEmbeddingRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastEmbeddingRequestAt = Date.now();
  return release;
}

function parseEmbeddingPrediction(prediction = {}, model = '') {
  const values =
    prediction?.embeddings?.values ||
    prediction?.values ||
    [];

  if (!Array.isArray(values) || !values.length) {
    throw new Error('Vertex AI returned an empty embedding vector.');
  }

  return {
    values,
    tokenCount: Number(prediction?.embeddings?.statistics?.token_count || 0),
    truncated: Boolean(prediction?.embeddings?.statistics?.truncated),
    model,
    dimensions: values.length,
  };
}

async function embedTexts(items = [], options = {}) {
  const config = getYmeConfig();
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => ({
        text: normalizeText(item?.text || ''),
        taskType: item?.taskType || options.taskType || 'RETRIEVAL_DOCUMENT',
        title: normalizeText(item?.title || options.title || ''),
      })).filter((item) => item.text)
    : [];

  if (!normalizedItems.length) return [];

  const startedAt = Date.now();
  const client = await getAuthClient();
  const results = [];

  try {
    for (const batch of chunkItems(normalizedItems, Math.max(1, config.embedding.batchSize))) {
      const release = await waitForEmbeddingSlot();

      try {
        const response = await client.request({
          url: getEmbeddingEndpoint(),
          method: 'POST',
          data: {
            instances: batch.map(buildEmbeddingInstance),
            parameters: {
              autoTruncate:
                options.autoTruncate === undefined
                  ? config.embedding.autoTruncate
                  : Boolean(options.autoTruncate),
              outputDimensionality:
                Number.isFinite(Number(options.outputDimensionality))
                  ? Number(options.outputDimensionality)
                  : config.embedding.outputDimensionality,
            },
          },
        });

        const predictions = Array.isArray(response?.data?.predictions)
          ? response.data.predictions
          : [];

        for (const prediction of predictions) {
          results.push(parseEmbeddingPrediction(prediction, config.embedding.modelId));
        }
      } finally {
        release();
      }
    }
  } catch (error) {
    incrementCounter('embeddingFailures');
    throw error;
  }

  incrementCounter('embeddingsGenerated', results.length);
  recordDuration('embeddingGeneration', Date.now() - startedAt);
  recordDuration('embeddingBatchGeneration', Date.now() - startedAt);
  return results;
}

async function embedText({
  text,
  taskType = 'RETRIEVAL_DOCUMENT',
  title = '',
  outputDimensionality,
  autoTruncate,
} = {}) {
  const [result] = await embedTexts(
    [
      {
        text,
        taskType,
        title,
      },
    ],
    {
      outputDimensionality,
      autoTruncate,
    },
  );

  if (!result) {
    throw new Error('Embedding generation returned no result.');
  }

  return result;
}

async function embedQuery(text) {
  return embedText({
    text,
    taskType: 'RETRIEVAL_QUERY',
  });
}

module.exports = {
  isEmbeddingEnabled,
  embedTexts,
  embedText,
  embedQuery,
};
