const fs = require('node:fs/promises');

const { getProvider } = require('../providers');

function normalizeAudience(value) {
  return String(value || '').trim().toLowerCase() === 'engineering' ? 'engineering' : 'public';
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => ({
      role: String(entry?.role || '').trim() || 'user',
      content: String(entry?.content || '').trim(),
    }))
    .filter((entry) => entry.content);
}

async function health(_req, res, next) {
  try {
    const provider = getProvider('fastapi_rag');
    const response = await provider.health();
    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function chat(req, res, next) {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question is required.',
      });
    }

    const provider = getProvider('fastapi_rag');
    const response = await provider.chat({
      question,
      history: sanitizeHistory(req.body?.history),
      audience: normalizeAudience(req.body?.audience),
      includeDebug: Boolean(req.body?.includeDebug),
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function ingest(req, res, next) {
  const files = req.files || [];

  try {
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one file is required.',
      });
    }

    const provider = getProvider('fastapi_rag');
    const response = await provider.ingest({
      files,
      audience: normalizeAudience(req.body?.audience || 'engineering'),
    });

    res.json(response);
  } catch (error) {
    next(error);
  } finally {
    await Promise.all(
      files.map(async (file) => {
        if (!file?.path) return;
        try {
          await fs.unlink(file.path);
        } catch (_error) {}
      })
    );
  }
}

async function ingestJobs(_req, res, next) {
  try {
    const provider = getProvider('fastapi_rag');
    const response = await provider.ingestJobs();
    res.json(response);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  health,
  chat,
  ingest,
  ingestJobs,
};
