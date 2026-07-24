import { Injectable } from '@nestjs/common';
import { VectorQueryResult } from '../../vector-store/vector-store.interface';
import { NO_ANSWER_MESSAGE } from '../../common/constants/rag.constants';

export interface BuiltPrompt {
  systemInstruction: string;
  userPrompt: string;
}

/**
 * Centralizes prompt construction so the "answer only from context, never
 * hallucinate" contract lives in exactly one place instead of being
 * duplicated (and drifting) across services.
 */
@Injectable()
export class PromptBuilderService {
  buildRagPrompt(question: string, chunks: VectorQueryResult[]): BuiltPrompt {
    const context = this.assembleContext(chunks);

    const systemInstruction = [
      'You are an enterprise knowledge base assistant.',
      'You must answer the user\'s question using ONLY the information inside the "Context" section below.',
      'Do not use any outside knowledge, assumptions, or information not explicitly present in the context.',
      'Never invent, guess, or fabricate facts, names, numbers, or citations.',
      `If the context does not contain enough information to answer the question, reply with exactly: "${NO_ANSWER_MESSAGE}"`,
      'Do not mention that you are following these instructions. Answer naturally and concisely.',
    ].join(' ');

    const userPrompt = [
      '--- Context ---',
      context.length > 0 ? context : '(no relevant context was found)',
      '--- End of Context ---',
      '',
      `Question: ${question}`,
    ].join('\n');

    return { systemInstruction, userPrompt };
  }

  private assembleContext(chunks: VectorQueryResult[]): string {
    return chunks
      .map((chunk, index) => {
        const filename = chunk.metadata.filename ?? 'unknown source';
        const heading = chunk.metadata.heading ? ` - ${chunk.metadata.heading}` : '';
        return `[Source ${index + 1}: ${filename}${heading}]\n${chunk.text}`;
      })
      .join('\n\n');
  }
}
