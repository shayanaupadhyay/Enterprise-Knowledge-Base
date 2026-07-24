import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { EMBEDDING_PROVIDER, VECTOR_STORE } from '../common/constants/rag.constants';
import { EmbeddingProvider } from '../embedding/embedding-provider.interface';
import { VectorDocument, VectorStore } from '../vector-store/vector-store.interface';
import { PdfService } from './pdf/pdf.service';
import { ChunkingService } from './chunking/chunking.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly chunkingService: ChunkingService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
    @Inject(VECTOR_STORE) private readonly vectorStore: VectorStore,
  ) {}

  async ingestPdf(file: Express.Multer.File): Promise<UploadResponseDto> {
    const documentId = uuid();
    const uploadedAt = new Date().toISOString();

    this.logger.log(`Ingesting "${file.originalname}" (${file.size} bytes) as document ${documentId}`);

    const parsed = await this.pdfService.parse(file.buffer);
    const chunks = this.chunkingService.chunk(parsed.markdown, documentId);

    const embeddings = await this.embeddingProvider.embedBatch(chunks.map((chunk) => chunk.text));

    const documents: VectorDocument[] = chunks.map((chunk, index) => ({
      id: chunk.chunkId,
      text: chunk.text,
      embedding: embeddings[index],
      metadata: {
        filename: file.originalname,
        pageCount: parsed.pageCount,
        uploadTimestamp: uploadedAt,
        chunkId: chunk.chunkId,
        documentId,
        heading: chunk.heading ?? '',
      },
    }));

    await this.vectorStore.addDocuments(documents);

    this.logger.log(`Indexed ${documents.length} chunks from "${file.originalname}"`);

    return {
      success: true,
      message: 'Document uploaded and indexed successfully.',
      filename: file.originalname,
      pageCount: parsed.pageCount,
      chunkCount: documents.length,
      uploadedAt,
    };
  }
}
