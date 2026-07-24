import { Module } from '@nestjs/common';
import { VECTOR_STORE } from '../common/constants/rag.constants';
import { ChromaVectorStoreService } from './chroma-vector-store.service';

@Module({
  providers: [
    ChromaVectorStoreService,
    {
      provide: VECTOR_STORE,
      useExisting: ChromaVectorStoreService,
    },
  ],
  exports: [VECTOR_STORE],
})
export class VectorStoreModule {}
