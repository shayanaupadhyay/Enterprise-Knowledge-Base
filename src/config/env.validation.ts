import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Strongly-typed contract for every environment variable the application relies on.
 * Fails fast at bootstrap if a required value is missing or malformed, instead of
 * surfacing cryptic errors deep inside a service at request time.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  GEMINI_API_KEY: string;

  @IsOptional()
  @IsString()
  GEMINI_CHAT_MODEL: string = 'gemini-2.5-flash';

  @IsOptional()
  @IsString()
  GEMINI_EMBEDDING_MODEL: string = 'gemini-embedding-001';

  @IsOptional()
  @IsString()
  CHROMA_URL: string = 'http://localhost:8000';

  @IsOptional()
  @IsString()
  CHROMA_COLLECTION_NAME: string = 'knowledge_base';

  @IsOptional()
  @IsInt()
  @Min(1)
  MAX_UPLOAD_SIZE_MB: number = 10;

  @IsOptional()
  @IsInt()
  @Min(100)
  CHUNK_SIZE: number = 800;

  @IsOptional()
  @IsInt()
  @Min(0)
  CHUNK_OVERLAP: number = 150;

  @IsOptional()
  @IsInt()
  @Min(1)
  RETRIEVAL_TOP_K: number = 5;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
