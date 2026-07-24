import { Module } from '@nestjs/common';
import { EmbeddingModule } from '../embedding/embedding.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { RagService } from './rag.service';
import { PromptBuilderService } from './prompt/prompt-builder.service';
import { GeminiChatService } from './gemini-chat.service';

@Module({
  imports: [EmbeddingModule, VectorStoreModule],
  providers: [RagService, PromptBuilderService, GeminiChatService],
  exports: [RagService],
})
export class RagModule {}
