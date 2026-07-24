import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AppConfig } from '../config/configuration';
import { BuiltPrompt } from './prompt/prompt-builder.service';

/**
 * Thin wrapper around the Gemini generative model. Isolated from RagService
 * so the generation provider (Gemini today) can be swapped independently of
 * retrieval and prompt-building logic.
 */
@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name);
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const gemini = this.configService.get('gemini', { infer: true });
    this.client = new GoogleGenAI({ apiKey: gemini.apiKey });
    this.model = gemini.chatModel;
  }

  async generateAnswer(prompt: BuiltPrompt): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt.userPrompt,
        config: {
          systemInstruction: prompt.systemInstruction,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text || text.trim().length === 0) {
        throw new Error('Gemini returned an empty response');
      }
      return text.trim();
    } catch (error) {
      this.logger.error(`Gemini generation failed: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to generate an answer');
    }
  }
}
