const fastapiProvider = require('./fastapi.provider');

const PROVIDERS = {
  fastapi_rag: fastapiProvider,
  openai: fastapiProvider,
  gemini: fastapiProvider,
  claude: fastapiProvider
};

function getProvider(name) {
  return PROVIDERS[name] || fastapiProvider;
}

module.exports = {
  getProvider,
  PROVIDERS
};
