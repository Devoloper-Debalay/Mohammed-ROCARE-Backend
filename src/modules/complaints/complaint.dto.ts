import {IsOptional,IsString} from "class-validator";
export class ComplaintDto{ @IsString() subject!:string; @IsString() description!:string; @IsOptional() @IsString() attachmentUrl?:string; }
export class ComplaintReplyDto{ @IsString() message!:string; @IsOptional() @IsString() status?:string; }
