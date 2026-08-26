import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
export class CheckoutDto { @IsOptional() @IsString() deliveryAddress?: string; @IsOptional() @IsUUID() branchId?: string; }
export class OrderStatusDto { @IsEnum(["PENDING","ACCEPTED","DISPATCHED","COMPLETED","CONFIRMED","CANCELLED"] as any) status!: any; @IsOptional() @IsString() completionPhoto?: string; }
export class AssignOrderVendorDto { @IsUUID() vendorId!: string; }
export class BuyNowDto { @IsUUID() productId!: string; @IsInt() @Min(1) quantity!: number; @IsOptional() @IsString() deliveryAddress?: string; @IsOptional() @IsUUID() branchId?: string; }
