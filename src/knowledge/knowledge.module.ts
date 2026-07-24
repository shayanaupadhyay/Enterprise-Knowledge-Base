import { Module } from '@nestjs/common';
import { EmbeddingModule } from '../embedding/embedding.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { PdfService } from './pdf/pdf.service';
import { ChunkingService } from './chunking/chunking.service';

@Module({
  imports: [EmbeddingModule, VectorStoreModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, PdfService, ChunkingService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
