import { Type } from "class-transformer";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ArrayNotEmpty,
  IsUUID,
} from "class-validator";

export class SendTextMessageDto {
  @IsString()
  @IsNotEmpty({ message: "Message content is required." })
  content!: string;
}

export class SendFileMessageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration?: number; // voice message duration in seconds
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty({ message: "Message content is required." })
  content!: string;
}

export class MarkMessagesReadDto {
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  messageIds?: string[]; // if omitted or empty, all unread messages in the room are marked read
}