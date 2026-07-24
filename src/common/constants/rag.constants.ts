/** DI token for the pluggable vector store implementation (Chroma today, Pinecone/hybrid tomorrow). */
export const VECTOR_STORE = Symbol('VECTOR_STORE');

/** DI token for the pluggable embedding provider. */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export const SUPPORTED_MIME_TYPES = ['application/pdf'] as const;

export const NO_ANSWER_MESSAGE =
  "I couldn't find this information in the uploaded knowledge base.";
