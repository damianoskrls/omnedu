import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class OpenConversationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsIn(['admin', 'teacher'])
  kind?: 'admin' | 'teacher';

  @IsOptional()
  @IsString()
  withUserId?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
