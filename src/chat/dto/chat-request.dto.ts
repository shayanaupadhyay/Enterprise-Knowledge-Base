import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Question must not be empty.' })
  @MinLength(2, { message: 'Question is too short.' })
  @MaxLength(2000, { message: 'Question must be at most 2000 characters.' })
  question: string;
}
