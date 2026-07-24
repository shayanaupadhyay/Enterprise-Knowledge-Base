export class UploadResponseDto {
  success: boolean;
  message: string;
  filename: string;
  pageCount: number;
  chunkCount: number;
  uploadedAt: string;
}
