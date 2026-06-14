const crypto = require('crypto');

const { getYmeConfig } = require('../config/yme.config');
const { getVectorIndexDefinitions } = require('../config/vectorIndexes');
const MemoryEmbedding = require('../models/memoryEmbedding.model');
const { normalizeText } = require('../utils/textNormalizer');
const { isEmbeddingEnabled, embedQuery, embedText } = require('./embedding.service');
const { incrementCounter, recordDuration } = require('./metrics.service');
const { writeMemoryLog } = require('./log.service');
const { toObjectId } = require('../utils/yme.utils');

function buildContentHash({ taskType = 'RETRIEVAL_DOCUMENT', title = '', text = '' } = {}) {
  const normalizedTitle = normalizeText(title || '');
  const normalizedText = normalizeText(text || '');
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ taskType, title: normalizedTitle, text: normalizedText }))
    .digest('hex');
}

async function upsertMemoryEmbedding({
  userId,
  sourceType,
  sourceId,
  sourceApp = 'system',
  memoryTier = 'mid_term',
  taskType = 'RETRIEVAL_DOCUMENT',
  title = '',
  text,
  importance = 0.5,
  metadata = {},
}) {
  const normalizedText = normalizeText(text || '');
  const normalizedTitle = normalizeText(title || '');
  if (!normalizedText) return null;
  const config = getYmeConfig();
  const contentHash = buildContentHash({
    taskType,
    title: normalizedTitle,
    text: normalizedText,
  });

  const filter = {
    userId: toObjectId(userId),
    sourceType,
    sourceId: String(sourceId),
    memoryTier,
  };

  const existingDocument = await MemoryEmbedding.findOne(filter);
  if (
    existingDocument &&
    existingDocument.contentHash === contentHash &&
    existingDocument.status === 'ready' &&
    Array.isArray(existingDocument.embedding) &&
    existingDocument.embedding.length
  ) {
    const updatedDocument = await MemoryEmbedding.findOneAndUpdate(
      { _id: existingDocument._id },
      {
        $inc: { cacheHitCount: 1 },
        $set: { lastAccessedAt: new Date() },
      },
      { new: true },
    );
    incrementCounter('memoryEmbeddingCacheHit');
    return updatedDocument || existingDocument;
  }

  if (!isEmbeddingEnabled()) {
    return MemoryEmbedding.findOneAndUpdate(
      filter,
      {
        $set: {
          userId: filter.userId,
          sourceType,
          sourceId: filter.sourceId,
          sourceApp,
          memoryTier,
          taskType,
          model: '',
          title: normalizedTitle,
          text: normalizedText,
          contentHash,
          dimensions: 0,
          importance,
          status: 'skipped',
          metadata: {
            ...metadata,
            reason: 'embeddings_disabled',
          },
        },
      },
      { upsert: true, new: true },
    );
  }

  const startedAt = Date.now();
  try {
    const cachedEmbedding = await MemoryEmbedding.findOne({
      contentHash,
      taskType,
      model: config.embedding.modelId,
      status: 'ready',
      dimensions: { $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .lean();

    const embedding = cachedEmbedding
      ? {
          model: cachedEmbedding.model,
          values: cachedEmbedding.embedding,
          dimensions: cachedEmbedding.dimensions,
          tokenCount: Number(cachedEmbedding.metadata?.tokenCount || 0),
          truncated: Boolean(cachedEmbedding.metadata?.truncated),
          cached: true,
        }
      : await embedText({
          text: normalizedText,
          taskType,
          title: normalizedTitle,
        });

    if (cachedEmbedding) {
      incrementCounter('memoryEmbeddingCacheHit');
    }

    const document = await MemoryEmbedding.findOneAndUpdate(
      filter,
      {
        $set: {
          userId: filter.userId,
          sourceType,
          sourceId: filter.sourceId,
          sourceApp,
          memoryTier,
          taskType,
          model: embedding.model,
          title: normalizedTitle,
          text: normalizedText,
          contentHash,
          embedding: embedding.values,
          dimensions: embedding.dimensions,
          importance,
          status: 'ready',
          metadata: {
            ...metadata,
            tokenCount: embedding.tokenCount,
            truncated: embedding.truncated,
            cached: Boolean(embedding.cached),
            cachedFromSourceId: cachedEmbedding?.sourceId || '',
          },
        },
      },
      { upsert: true, new: true },
    );

    incrementCounter('memoryEmbeddingsUpserted');
    recordDuration('memoryEmbeddingUpsert', Date.now() - startedAt);
    return document;
  } catch (error) {
    incrementCounter('memoryEmbeddingsFailed');
    const failedDocument = await MemoryEmbedding.findOneAndUpdate(
      filter,
      {
        $set: {
          userId: filter.userId,
          sourceType,
          sourceId: filter.sourceId,
          sourceApp,
          memoryTier,
          taskType,
          title: normalizedTitle,
          text: normalizedText,
          contentHash,
          importance,
          status: 'failed',
          metadata: {
            ...metadata,
            error: error.message,
          },
        },
      },
      { upsert: true, new: true },
    );
    const failSoft = metadata?.failSoft === true || sourceType === 'memory_summary';
    await writeMemoryLog({
      userId,
      stage: 'embedding_upsert',
      level: failSoft ? 'warn' : 'error',
      status: failSoft ? 'degraded' : 'failed',
      message: failSoft ? 'YME embedding refresh degraded; continuing without blocking memory consolidation.' : 'YME embedding refresh failed.',
      error,
      metadata: {
        sourceType,
        sourceId,
        memoryTier,
      },
    });
    if (failSoft) return failedDocument;
    throw error;
  }
}

function buildVectorFilter({ userId, sourceTypes = [], sourceApp = '', memoryTiers = [] }) {
  const clauses = [{ userId: toObjectId(userId) }];

  if (sourceApp) clauses.push({ sourceApp });
  if (sourceTypes.length === 1) clauses.push({ sourceType: sourceTypes[0] });
  if (sourceTypes.length > 1) clauses.push({ sourceType: { $in: sourceTypes } });
  if (memoryTiers.length === 1) clauses.push({ memoryTier: memoryTiers[0] });
  if (memoryTiers.length > 1) clauses.push({ memoryTier: { $in: memoryTiers } });

  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

async function searchUserMemory({
  userId,
  query,
  limit = 8,
  sourceTypes = [],
  sourceApp = '',
  memoryTiers = [],
} = {}) {
  const config = getYmeConfig();
  if (!config.vector.enabled || !isEmbeddingEnabled()) return [];

  const normalizedQuery = normalizeText(query || '');
  if (!normalizedQuery) return [];

  const queryEmbedding = await embedQuery(normalizedQuery);
  const startedAt = Date.now();
  const filter = buildVectorFilter({ userId, sourceTypes, sourceApp, memoryTiers });

  try {
    const results = await MemoryEmbedding.aggregate([
      {
        $vectorSearch: {
          index: config.vector.indexName,
          path: 'embedding',
          queryVector: queryEmbedding.values,
          numCandidates: Math.max(limit * config.vector.numCandidatesMultiplier, limit),
          limit,
          filter,
        },
      },
      {
        $project: {
          sourceType: 1,
          sourceId: 1,
          sourceApp: 1,
          memoryTier: 1,
          title: 1,
          text: 1,
          importance: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);

    incrementCounter('memoryRetrievalHits', results.length);
    recordDuration('memoryRetrieval', Date.now() - startedAt);
    return results;
  } catch (error) {
    await writeMemoryLog({
      userId,
      stage: 'vector_search',
      level: 'warn',
      status: 'fallback',
      message: 'Atlas Vector Search query failed.',
      error,
      metadata: {
        indexName: config.vector.indexName,
      },
    });
    return [];
  }
}

function getRequiredVectorIndexes() {
  return getVectorIndexDefinitions();
}

module.exports = {
  upsertMemoryEmbedding,
  searchUserMemory,
  getRequiredVectorIndexes,
  buildContentHash,
};
