/**
 * Provider-agnostic embedding contract. Swapping Gemini for another embedding
 * provider (OpenAI, Cohere, a local model, ...) later only requires a new
 * class implementing this interface plus a one-line change in EmbeddingModule -
 * no changes to KnowledgeService, RagService, or anything downstream.
 */
export interface EmbeddingProvider {
  /** Embeds a single piece of text (e.g. a user question). */
  embedText(text: string): Promise<number[]>;

  /** Embeds many chunks of text in as few provider calls as possible. */
  embedBatch(texts: string[]): Promise<number[][]>;
}
