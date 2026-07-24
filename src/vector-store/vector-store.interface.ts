export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, string | number | boolean>;
}

export interface VectorQueryResult {
  id: string;
  text: string;
  metadata: Record<string, string | number | boolean>;
  /** Similarity score in [0, 1], higher is more relevant. */
  score: number;
}

/**
 * Provider-agnostic vector database contract. ChromaVectorStoreService is the
 * only implementation today; a future Pinecone or hybrid-search backend can
 * implement this same interface and be swapped in via VectorStoreModule
 * without touching KnowledgeService or RagService.
 */
export interface VectorStore {
  addDocuments(documents: VectorDocument[]): Promise<void>;
  querySimilar(embedding: number[], topK: number): Promise<VectorQueryResult[]>;
}
