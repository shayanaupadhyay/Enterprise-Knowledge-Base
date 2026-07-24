import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AppConfig } from '../config/configuration';
import { EmbeddingProvider } from './embedding-provider.interface';

/** Gemini enforces a per-request cap on how many texts can be embedded at once. */
const MAX_BATCH_SIZE = 100;

@Injectable()
export class GeminiEmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const gemini = this.configService.get('gemini', { infer: true });
    this.client = new GoogleGenAI({ apiKey: gemini.apiKey });
    this.model = gemini.embeddingModel;
  }

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const batches = this.splitIntoBatches(texts, MAX_BATCH_SIZE);
    const results: number[][] = [];

    for (const batch of batches) {
      try {
        const response = await this.client.models.embedContent({
          model: this.model,
          contents: batch,
        });

        const embeddings = response.embeddings ?? [];
        if (embeddings.length !== batch.length) {
          throw new Error(
            `Expected ${batch.length} embeddings from Gemini, received ${embeddings.length}`,
          );
        }

        for (const embedding of embeddings) {
          if (!embedding.values) {
            throw new Error('Gemini returned an embedding with no values');
          }
          results.push(embedding.values);
        }
      } catch (error) {
        this.logger.error(`Failed to generate embeddings via Gemini: ${(error as Error).message}`);
        throw new InternalServerErrorException('Failed to generate embeddings');
      }
    }

    return results;
  }

  private splitIntoBatches<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }
}
