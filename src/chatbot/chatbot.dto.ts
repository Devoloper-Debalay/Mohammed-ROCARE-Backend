import { Expose } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
 
/**
 * Body for POST /api/chatbot/message
 */
export class SendMessageDto {
  @Expose()
  @IsOptional()
  @IsUUID(4, { message: "sessionId must be a valid UUID." })
  sessionId?: string;
 
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "message is required." })
  @MaxLength(4000, { message: "message must be at most 4000 characters." })
  message!: string;
}
 
/**
 * Body fields for POST /api/chatbot/message/image
 * (the file itself is handled by multer upstream, not part of this DTO —
 * validate file presence/size/mimetype in the router/controller as before)
 */
export class SendMessageWithImageDto {
  @Expose()
  @IsOptional()
  @IsUUID(4, { message: "sessionId must be a valid UUID." })
  sessionId?: string;
 
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "message is required." })
  @MaxLength(4000, { message: "message must be at most 4000 characters." })
  message!: string;
}