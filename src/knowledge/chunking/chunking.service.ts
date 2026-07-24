import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

export interface TextChunk {
  chunkId: string;
  text: string;
  heading: string | null;
}

/**
 * Splits markdown into overlapping, heading-aware chunks using a recursive
 * "try the biggest natural separator first, fall back to smaller ones"
 * strategy: headings -> paragraphs -> sentences -> words. This keeps chunk
 * boundaries on sentence edges whenever possible instead of cutting mid-sentence.
 */
@Injectable()
export class ChunkingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly separators = ['\n## ', '\n\n', '\n', '. ', ' '];

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const chunking = this.configService.get('chunking', { infer: true });
    this.chunkSize = chunking.chunkSize;
    this.chunkOverlap = chunking.chunkOverlap;
  }

  chunk(markdown: string, documentId: string): TextChunk[] {
    const segments = this.recursiveSplit(markdown.trim(), this.separators);
    const merged = this.mergeWithOverlap(segments);

    let currentHeading: string | null = null;
    return merged.map((text, index) => {
      const headingMatch = text.match(/^##\s+(.+)$/m);
      if (headingMatch) {
        currentHeading = headingMatch[1].trim();
      }
      return {
        chunkId: `${documentId}-chunk-${index}`,
        text: text.trim(),
        heading: currentHeading,
      };
    });
  }

  private recursiveSplit(text: string, separators: string[]): string[] {
    if (text.length <= this.chunkSize) {
      return [text];
    }

    if (separators.length === 0) {
      return this.hardSplit(text);
    }

    const [separator, ...rest] = separators;
    const parts = text.split(separator).filter((part) => part.length > 0);

    if (parts.length === 1) {
      return this.recursiveSplit(text, rest);
    }

    const results: string[] = [];
    for (const part of parts) {
      const withSeparator = separator.trim().length > 0 && separator !== ' ' ? separator + part : part;
      if (withSeparator.length > this.chunkSize) {
        results.push(...this.recursiveSplit(withSeparator, rest));
      } else {
        results.push(withSeparator);
      }
    }
    return results;
  }

  /** Last resort when even a single word/sentence exceeds chunkSize: hard character split. */
  private hardSplit(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += this.chunkSize) {
      chunks.push(text.slice(i, i + this.chunkSize));
    }
    return chunks;
  }

  /** Greedily packs small segments up to chunkSize, then repeats the tail of each chunk as overlap for the next. */
  private mergeWithOverlap(segments: string[]): string[] {
    const merged: string[] = [];
    let current = '';

    for (const segment of segments) {
      const candidate = current.length > 0 ? `${current}${segment}` : segment;

      if (candidate.length > this.chunkSize && current.length > 0) {
        merged.push(current);
        const overlapText = current.slice(Math.max(0, current.length - this.chunkOverlap));
        current = overlapText + segment;
      } else {
        current = candidate;
      }
    }

    if (current.trim().length > 0) {
      merged.push(current);
    }

    return merged;
  }
}
