import {IsObject,IsOptional,IsString} from "class-validator";
export class PlatformSettingDto{ @IsString() key!:string; @IsObject() value!:Record<string,unknown>; @IsOptional() @IsString() description?:string; }
