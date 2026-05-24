const path = require('node:path');

let transformersModulePromise = null;
const pipelineCache = new Map();

async function loadTransformersModule() {
  if (!transformersModulePromise) {
    transformersModulePromise = import('@huggingface/transformers')
      .catch(async (primaryError) => {
        try {
          return await import('@xenova/transformers');
        } catch (_fallbackError) {
          throw primaryError;
        }
      });
  }

  const mod = await transformersModulePromise;
  const runtime = mod?.env || mod?.default?.env ? (mod.default || mod) : mod;

  if (runtime?.env && !runtime.env.__yenkasaConfigured) {
    runtime.env.cacheDir =
      process.env.YENKASA_TRANSFORMERS_CACHE_DIR ||
      path.join(process.cwd(), 'tmp', 'transformers-cache');
    runtime.env.allowRemoteModels =
      process.env.YENKASA_ALLOW_REMOTE_MODELS !== 'false';
    runtime.env.allowLocalModels = true;
    runtime.env.__yenkasaConfigured = true;
  }

  return runtime;
}

async function getPipeline(task, model, options = {}) {
  const key = JSON.stringify({ task, model, options });

  if (!pipelineCache.has(key)) {
    pipelineCache.set(
      key,
      (async () => {
        const runtime = await loadTransformersModule();
        return runtime.pipeline(task, model, options);
      })(),
    );
  }

  return pipelineCache.get(key);
}

function clearPipelineCache() {
  pipelineCache.clear();
}

module.exports = {
  loadTransformersModule,
  getPipeline,
  clearPipelineCache,
};
