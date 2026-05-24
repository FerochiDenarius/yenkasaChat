const { getYmeConfig } = require('./yme.config');

function getVectorIndexDefinitions() {
  const config = getYmeConfig();

  return [
    {
      collection: 'memory_embeddings',
      name: config.vector.indexName,
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: config.embedding.outputDimensionality,
            similarity: config.vector.similarity,
            quantization: config.vector.quantization,
          },
          { type: 'filter', path: 'userId' },
          { type: 'filter', path: 'memoryTier' },
          { type: 'filter', path: 'sourceType' },
          { type: 'filter', path: 'sourceApp' },
        ],
      },
    },
  ];
}

module.exports = {
  getVectorIndexDefinitions,
};
