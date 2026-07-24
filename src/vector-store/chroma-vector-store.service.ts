import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, CloudClient, Collection, IEmbeddingFunction } from 'chromadb';
import { AppConfig } from '../config/configuration';
import { VectorDocument, VectorQueryResult, VectorStore } from './vector-store.interface';

/**
 * We always supply pre-computed Gemini embeddings ourselves, so Chroma's
 * built-in embedding function must never be invoked. This stub satisfies the
 * client's type contract while making an accidental implicit call fail loudly.
 */
const explicitEmbeddingsOnly: IEmbeddingFunction = {
  generate: async (): Promise<number[][]> => {
    throw new InternalServerErrorException(
      'Chroma attempted to auto-generate embeddings; embeddings must always be supplied explicitly.',
    );
  },
};

@Injectable()
export class ChromaVectorStoreService implements VectorStore, OnModuleInit {
  private readonly logger = new Logger(ChromaVectorStoreService.name);
  private readonly client: ChromaClient;
  private readonly collectionName: string;
  private collection: Collection;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const chroma = this.configService.get('chroma', { infer: true });
    this.client = chroma.apiKey
      ? new CloudClient({ apiKey: chroma.apiKey, tenant: chroma.tenant, database: chroma.database })
      : new ChromaClient({ path: chroma.url });
    this.collectionName = chroma.collectionName;
  }

  async onModuleInit(): Promise<void> {
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        embeddingFunction: explicitEmbeddingsOnly,
        metadata: { 'hnsw:space': 'cosine' },
      });
      this.logger.log(`Connected to ChromaDB collection "${this.collectionName}"`);
    } catch (error) {
      this.logger.error(
        `Unable to connect to ChromaDB at startup: ${(error as Error).message}`,
      );
      // Do not crash the app: connectivity is retried lazily on first real request.
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    try {
      const collection = await this.getCollection();
      await collection.add({
        ids: documents.map((doc) => doc.id),
        embeddings: documents.map((doc) => doc.embedding),
        documents: documents.map((doc) => doc.text),
        metadatas: documents.map((doc) => doc.metadata),
      });
    } catch (error) {
      this.logger.error(`Failed to persist documents to ChromaDB: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to store knowledge in the vector database');
    }
  }

  async querySimilar(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    try {
      const collection = await this.getCollection();
      const results = await collection.query({
        queryEmbeddings: [embedding],
        nResults: topK,
      });

      const ids = results.ids[0] ?? [];
      const documents = results.documents[0] ?? [];
      const metadatas = results.metadatas[0] ?? [];
      const distances = results.distances?.[0] ?? [];

      return ids.map((id, index) => ({
        id,
        text: documents[index] ?? '',
        metadata: (metadatas[index] ?? {}) as Record<string, string | number | boolean>,
        score: this.distanceToSimilarity(distances[index]),
      }));
    } catch (error) {
      this.logger.error(`Failed to query ChromaDB: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to search the knowledge base');
    }
  }

  private async getCollection(): Promise<Collection> {
    if (!this.collection) {
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        embeddingFunction: explicitEmbeddingsOnly,
        metadata: { 'hnsw:space': 'cosine' },
      });
    }
    return this.collection;
  }

  /** Cosine distance (0 = identical) -> cosine similarity (1 = identical), clamped to [0, 1]. */
  private distanceToSimilarity(distance: number | undefined): number {
    if (distance === undefined) {
      return 0;
    }
    return Math.max(0, Math.min(1, 1 - distance));
  }
}
