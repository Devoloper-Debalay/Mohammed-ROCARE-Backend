import {IsEnum,IsNumber,IsOptional,IsString,Min} from "class-validator";
export class ProductDto{ @IsString() name!:string; @IsEnum(["RO","AC","GEYSER","OTHER"] as any) category!:any; @IsOptional() @IsString() description?:string; @IsNumber() @Min(0) price!:number; @IsOptional() @IsNumber() discountPercent?:number; @IsOptional() stock?:number; @IsOptional() images?:string[]; @IsOptional() branchId?:string; }
export class PartDto{ @IsString() name!:string; @IsOptional() @IsString() description?:string; @IsNumber() @Min(0) price!:number; @IsOptional() stock?:number; @IsOptional() images?:string[]; }
export class InventoryAdjustDto{ @IsNumber() quantity!:number; @IsOptional() @IsString() note?:string; }
