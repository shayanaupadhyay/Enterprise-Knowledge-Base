import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppConfig } from '../config/configuration';
import { SUPPORTED_MIME_TYPES } from '../common/constants/rag.constants';
import { KnowledgeService } from './knowledge.service';
import { UploadResponseDto } from './dto/upload-response.dto';

/** Hard safety-net cap enforced by Multer before any application-level validation runs. */
const MULTER_HARD_CAP_BYTES = 25 * 1024 * 1024;

@Controller('knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CAP_BYTES },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File): Promise<UploadResponseDto> {
    this.validateFile(file);
    return this.knowledgeService.ingestPdf(file);
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new BadRequestException('No file was uploaded. Please attach a PDF under field "file".');
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.mimetype as (typeof SUPPORTED_MIME_TYPES)[number])) {
      throw new BadRequestException('Only PDF files are supported.');
    }

    const upload = this.configService.get('upload', { infer: true });
    if (file.size > upload.maxSizeBytes) {
      throw new BadRequestException(`File exceeds the maximum allowed size of ${upload.maxSizeMb}MB.`);
    }

    if (file.size === 0) {
      throw new BadRequestException('The uploaded file is empty.');
    }
  }
}
