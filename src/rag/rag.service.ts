import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { EMBEDDING_PROVIDER, NO_ANSWER_MESSAGE, VECTOR_STORE } from '../common/constants/rag.constants';
import { EmbeddingProvider } from '../embedding/embedding-provider.interface';
import { VectorStore } from '../vector-store/vector-store.interface';
import { PromptBuilderService } from './prompt/prompt-builder.service';
import { GeminiChatService } from './gemini-chat.service';

export interface RagAnswer {
  answer: string;
  sources: string[];
}

/**
 * Orchestrates the full retrieve -> augment -> generate pipeline. This is the
 * single place that composes embedding, vector search, prompt building, and
 * generation - future features like Ragas evaluation or Redis-backed
 * conversation memory hook in here without touching the individual services.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly topK: number;

  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    @Inject(VECTOR_STORE) private readonly vectorStore: VectorStore,
    private readonly promptBuilder: PromptBuilderService,
    private readonly geminiChatService: GeminiChatService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.topK = this.configService.get('retrieval', { infer: true }).topK;
  }

  async answerQuestion(question: string): Promise<RagAnswer> {
    const questionEmbedding = await this.embeddingProvider.embedText(question);
    const relevantChunks = await this.vectorStore.querySimilar(questionEmbedding, this.topK);

    if (relevantChunks.length === 0) {
      this.logger.warn(`No relevant chunks found for question: "${question}"`);
      return { answer: NO_ANSWER_MESSAGE, sources: [] };
    }

    const prompt = this.promptBuilder.buildRagPrompt(question, relevantChunks);
    const answer = await this.geminiChatService.generateAnswer(prompt);

    const sources = this.extractUniqueSources(relevantChunks.map((chunk) => chunk.metadata.filename));

    return {
      answer,
      sources: answer.includes(NO_ANSWER_MESSAGE) ? [] : sources,
    };
  }

  private extractUniqueSources(filenames: unknown[]): string[] {
    const unique = new Set<string>();
    for (const filename of filenames) {
      if (typeof filename === 'string' && filename.length > 0) {
        unique.add(filename);
      }
    }
    return Array.from(unique);
  }
}
