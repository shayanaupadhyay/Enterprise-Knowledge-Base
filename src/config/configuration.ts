export interface AppConfig {
  port: number;
  nodeEnv: string;
  gemini: {
    apiKey: string;
    chatModel: string;
    embeddingModel: string;
  };
  chroma: {
    url: string;
    apiKey: string | undefined;
    tenant: string | undefined;
    database: string | undefined;
    collectionName: string;
  };
  upload: {
    maxSizeMb: number;
    maxSizeBytes: number;
  };
  chunking: {
    chunkSize: number;
    chunkOverlap: number;
  };
  retrieval: {
    topK: number;
  };
}

export default (): AppConfig => {
  const maxSizeMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '10', 10);

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? '',
      chatModel: process.env.GEMINI_CHAT_MODEL ?? 'gemini-flash-latest',
      embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
    },
    chroma: {
      url: process.env.CHROMA_URL ?? 'http://localhost:8000',
      apiKey: process.env.CHROMA_API_KEY || undefined,
      tenant: process.env.CHROMA_TENANT || undefined,
      database: process.env.CHROMA_DATABASE || undefined,
      collectionName: process.env.CHROMA_COLLECTION_NAME ?? 'knowledge_base',
    },
    upload: {
      maxSizeMb,
      maxSizeBytes: maxSizeMb * 1024 * 1024,
    },
    chunking: {
      chunkSize: parseInt(process.env.CHUNK_SIZE ?? '800', 10),
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP ?? '150', 10),
    },
    retrieval: {
      topK: parseInt(process.env.RETRIEVAL_TOP_K ?? '5', 10),
    },
  };
};
