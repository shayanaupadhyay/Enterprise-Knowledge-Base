import { Module } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from '../common/constants/rag.constants';
import { GeminiEmbeddingService } from './gemini-embedding.service';

@Module({
  providers: [
    GeminiEmbeddingService,
    {
      provide: EMBEDDING_PROVIDER,
      useExisting: GeminiEmbeddingService,
    },
  ],
  exports: [EMBEDDING_PROVIDER, GeminiEmbeddingService],
})
export class EmbeddingModule {}
