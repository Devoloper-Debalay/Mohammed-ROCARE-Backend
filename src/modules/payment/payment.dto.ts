import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateOrderDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() receipt?: string;
  @IsOptional() @IsString() serviceRequestId?: string;
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsString() vendorId?: string;
}

export class VerifyPaymentDto {
  @IsString() razorpayOrderId!: string;
  @IsString() razorpayPaymentId!: string;
  @IsString() razorpaySignature!: string;
  @IsOptional() @IsString() paymentId?: string;
}
