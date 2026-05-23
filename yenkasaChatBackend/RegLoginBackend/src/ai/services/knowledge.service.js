const mongoose = require('mongoose');

const AIEmbedding = require('../models/aiEmbedding.model');
const AIKnowledgeChunk = require('../models/aiKnowledgeChunk.model');
const { resolveMode } = require('../utils/mode-config');

function uniqueSources(sources) {
  const seen = new Set();
  const deduped = [];

  for (const source of sources) {
    const key = source?.id || source?.citation || source?.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function formatRetrievalContext(sources) {
  return sources
    .map((source, index) => {
      const label = source?.label || `H${index + 1}`;
      const title = source?.title || 'Unknown source';
      const citation = source?.citation ? ` (${source.citation})` : '';
      const excerpt = String(source?.excerpt || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220);
      return `[${label}] ${title}${citation}: ${excerpt}`;
    })
    .join('\n');
}

async function buildRetrievalContext({ message, mode, provider }) {
  const config = resolveMode(mode);
  const audiences = config.retrievalAudiences || [config.audience];

  const responses = await Promise.all(
    audiences.map(async (audience) => {
      try {
        const result = await provider.search({
          question: message,
          audience,
          topK: audience === 'engineering' ? 4 : 4
        });
        return { audience, sources: result?.sources || [] };
      } catch (_error) {
        return { audience, sources: [] };
      }
    })
  );

  const mergedSources = uniqueSources(
    responses.flatMap((item) =>
      (item.sources || []).map((source) => ({
        ...source,
        retrievedAudience: item.audience
      }))
    )
  ).slice(0, 8);

  return {
    audiences,
    sources: mergedSources,
    contextSummary: formatRetrievalContext(mergedSources)
  };
}

async function ingestKnowledgeFiles({ files, audience = 'public', userId, provider }) {
  const batchId = new mongoose.Types.ObjectId().toString();
  const ingestResult = await provider.ingest({ files, audience });

  for (const file of files) {
    await AIKnowledgeChunk.create({
      batchId,
      sourceFile: file.originalname,
      audience,
      uploadedBy: userId,
      provider: provider.name,
      status: 'ingested',
      metadata: {
        targetCollection: ingestResult.target_collection,
        chunksInserted: ingestResult.chunks_inserted
      }
    });
  }

  await AIEmbedding.create({
    batchId,
    audience,
    provider: provider.name,
    vectorStore: 'chroma',
    knowledgeSourceCount: files.length,
    status: 'synced',
    metadata: {
      targetCollection: ingestResult.target_collection,
      chunksInserted: ingestResult.chunks_inserted,
      vectorDbPath: ingestResult.vector_db_path
    }
  });

  return {
    batchId,
    ...ingestResult
  };
}

module.exports = {
  buildRetrievalContext,
  ingestKnowledgeFiles
};
