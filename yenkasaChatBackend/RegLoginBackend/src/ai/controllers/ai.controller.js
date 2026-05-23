const fs = require('node:fs/promises');

const aiService = require('../services/ai.service');
const knowledgeService = require('../services/knowledge.service');
const moderationService = require('../services/moderation.service');
const { getProvider } = require('../providers');
const { resolveMode } = require('../utils/mode-config');

function normalizeRequestedUserId(req) {
  return String(req.body?.userId || '').trim();
}

function enforceUserScope(req, res) {
  const requestedUserId = normalizeRequestedUserId(req);
  const authenticatedUserId = String(req.user?._id || req.user?.id || '');

  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    res.status(403).json({
      success: false,
      message: 'AI requests can only be made for the authenticated user.'
    });
    return false;
  }

  return true;
}

function chunkAnswer(text, wordsPerChunk = 16) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let index = 0; index < words.length; index += wordsPerChunk) {
    chunks.push(words.slice(index, index + wordsPerChunk).join(' '));
  }

  return chunks.length ? chunks : [''];
}

async function chat(req, res, next) {
  try {
    if (!enforceUserScope(req, res)) return;

    const response = await aiService.chat({
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      user: req.user,
      mode: req.body?.mode || 'hybrid',
      includeDebug: Boolean(req.body?.includeDebug)
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function streamChat(req, res, next) {
  try {
    if (!enforceUserScope(req, res)) return;

    const response = await aiService.chat({
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      user: req.user,
      mode: req.body?.mode || 'hybrid',
      includeDebug: Boolean(req.body?.includeDebug)
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: meta\ndata: ${JSON.stringify({
      success: true,
      conversationId: response.conversationId,
      mode: response.mode,
      provider: response.provider
    })}\n\n`);

    for (const chunk of chunkAnswer(response.answer)) {
      res.write(`event: token\ndata: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write(`event: done\ndata: ${JSON.stringify(response)}\n\n`);
    res.end();
  } catch (error) {
    next(error);
  }
}

async function getSuggestions(req, res, next) {
  try {
    const response = await aiService.getSuggestions({
      conversationId: req.query?.conversationId,
      user: req.user,
      mode: req.query?.mode || 'hybrid'
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function moderate(req, res, next) {
  try {
    if (!enforceUserScope(req, res)) return;

    const response = await moderationService.moderatePostContent({
      text: req.body?.text,
      imageUrls: req.body?.imageUrls,
      videoUrl: req.body?.videoUrl,
      audioUrl: req.body?.audioUrl,
      userId: normalizeRequestedUserId(req) || String(req.user?._id || req.user?.id || ''),
      includeDebug: Boolean(req.body?.includeDebug),
      source: 'http_api',
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function getConversationHistory(req, res, next) {
  try {
    const response = await aiService.getConversationHistory({
      conversationId: req.params?.conversationId,
      user: req.user
    });

    res.json({
      success: true,
      ...response
    });
  } catch (error) {
    next(error);
  }
}

async function getModes(req, res, next) {
  try {
    res.json(aiService.getModes());
  } catch (error) {
    next(error);
  }
}

async function ingestKnowledge(req, res, next) {
  const files = req.files || [];
  try {
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one knowledge file is required.'
      });
    }

    const audience = req.body?.audience || resolveMode(req.body?.mode || 'hybrid').audience;
    const provider = getProvider('fastapi_rag');

    const result = await knowledgeService.ingestKnowledgeFiles({
      files,
      audience,
      userId: req.user._id || req.user.id,
      provider
    });

    res.json({
      success: true,
      ...result
    });
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

module.exports = {
  chat,
  streamChat,
  moderate,
  getSuggestions,
  getConversationHistory,
  getModes,
  ingestKnowledge
};
