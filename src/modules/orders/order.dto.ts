import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums";

export class CheckoutDto {
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class OrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  completionPhoto?: string;
}

export class OrderPaymentStatusDto {
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;

  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class AssignOrderVendorDto {
  @IsUUID()
  vendorId!: string;
}

export class BuyNowDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}
