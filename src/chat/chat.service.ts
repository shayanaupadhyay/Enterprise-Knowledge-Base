import { Injectable } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { ChatResponseDto } from './dto/chat-response.dto';

@Injectable()
export class ChatService {
  constructor(private readonly ragService: RagService) {}

  async ask(question: string): Promise<ChatResponseDto> {
    return this.ragService.answerQuestion(question);
  }
}
