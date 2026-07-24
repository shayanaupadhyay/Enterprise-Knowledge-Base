import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';

export interface ParsedPdf {
  /** Markdown-flavoured, cleaned document text ready for chunking. */
  markdown: string;
  pageCount: number;
}

/**
 * Non-printable ASCII control codes (0-8, 11-31, excluding tab/newline/CR)
 * that sometimes leak out of PDF text extraction. Built from char codes
 * rather than a literal regex to avoid embedding invisible bytes in source.
 */
const CONTROL_CHAR_CODES: number[] = [];
for (let code = 0; code <= 31; code += 1) {
  const isTabOrNewlineOrCarriageReturn = code === 9 || code === 10 || code === 13;
  if (!isTabOrNewlineOrCarriageReturn) {
    CONTROL_CHAR_CODES.push(code);
  }
}
const CONTROL_CHAR_REGEX = new RegExp(
  '[' + CONTROL_CHAR_CODES.map((code) => String.fromCharCode(code)).join('') + ']',
  'g',
);

/**
 * Owns everything between "raw PDF bytes" and "clean markdown text":
 * extraction, whitespace/artifact cleanup, and a lightweight heading heuristic.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async parse(buffer: Buffer): Promise<ParsedPdf> {
    const extracted = await this.extractText(buffer);
    const cleaned = this.cleanText(extracted.text);
    const markdown = this.toMarkdown(cleaned);

    return { markdown, pageCount: extracted.pageCount };
  }

  private async extractText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
    try {
      const result = await pdfParse(buffer);
      if (!result.text || result.text.trim().length === 0) {
        throw new BadRequestException(
          'The uploaded PDF contains no extractable text (it may be a scanned image).',
        );
      }
      return { text: result.text, pageCount: result.numpages ?? 1 };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to parse PDF: ${(error as Error).message}`);
      throw new BadRequestException('The uploaded file could not be read as a valid PDF.');
    }
  }

  /** Strips PDF-extraction artifacts: broken hyphenation, repeated whitespace, control chars. */
  private cleanText(rawText: string): string {
    return rawText
      .replace(/\r\n/g, '\n')
      .replace(CONTROL_CHAR_REGEX, '')
      .replace(/-\n(?=[a-z])/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  /**
   * Heuristic heading detection: short, standalone lines not ending in
   * sentence punctuation are promoted to markdown headings so downstream
   * chunking can use them as natural chunk boundaries.
   */
  private toMarkdown(cleanedText: string): string {
    const lines = cleanedText.split('\n');

    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (this.looksLikeHeading(trimmed)) {
          return `## ${trimmed}`;
        }
        return line;
      })
      .join('\n');
  }

  private looksLikeHeading(line: string): boolean {
    if (line.length === 0 || line.length > 80) {
      return false;
    }
    if (/[.,;:]$/.test(line)) {
      return false;
    }
    const isTitleCaseOrUpper = /^[A-Z0-9][A-Za-z0-9 ,'&()\-/]*$/.test(line);
    const wordCount = line.split(/\s+/).length;
    return isTitleCaseOrUpper && wordCount <= 12;
  }
}
