import { Expose, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { VendorComplaintCategory } from "../../generated/prisma/enums";

export class UpdateVendorProfileDto {
  @Expose()
  @IsOptional()
  @IsString()
  vendorCode?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @Expose()
  @IsOptional()
  @IsEmail()
  email?: string;

  @Expose()
  @IsOptional()
  @IsString()
  phone?: string;

  @Expose()
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @Expose()
  @IsOptional()
  @IsString()
  address?: string;

  @Expose()
  @IsOptional()
  @IsString()
  city?: string;

  @Expose()
  @IsOptional()
  @IsString()
  district?: string;

  @Expose()
  @IsOptional()
  @IsString()
  state?: string;

  @Expose()
  @IsOptional()
  @IsString()
  pincode?: string;

  @Expose()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @Expose()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @Expose()
  @IsOptional()
  @IsNumber()
  experienceYears?: number;

  @Expose()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @Expose()
  @IsOptional()
  @IsString()
  specialization?: string; // Single specialization
}

export class UpdateVendorBankDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "vendorCode is required." })
  vendorCode!: string;

  @Expose()
  @IsString()
  @IsNotEmpty({ message: "bankAccount is required." })
  bankAccount!: string;

  @Expose()
  @IsString()
  @IsNotEmpty({ message: "ifsc is required." })
  ifsc!: string;

  @Expose()
  @IsOptional()
  @IsString()
  upiId?: string;
}

export class UpdateVendorKycDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "vendorCode is required." })
  vendorCode!: string;

  @Expose()
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @Expose()
  @IsOptional()
  @IsString()
  panNumber?: string;
}

export class RequestAccountDeletionDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "reason is required." })
  @MaxLength(500)
  reason!: string;
}

export class ChangeVendorPasswordDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "currentPassword is required." })
  currentPassword!: string;

  @Expose()
  @IsString()
  @IsNotEmpty({ message: "newPassword is required." })
  @MaxLength(72)
  newPassword!: string;
}

export class RechargeWalletDto {
  @Expose() @IsNumber() @Min(1) amount!: number;
}

export class WalletIssueDto {
  @Expose() @IsString() @IsNotEmpty() subject!: string;
  @Expose() @IsString() @IsNotEmpty() description!: string;
}

export class AdminWalletAdjustmentDto {
  @Expose() @IsString() @IsNotEmpty() vendorId!: string;
  @Expose() @IsNumber() @Min(0.01) amount!: number;
  @Expose() @IsOptional() @IsString() note?: string;
}

export class LeadActionDto {
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: "latitude must be a valid number" },
  )
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: "longitude must be a valid number" },
  )
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: "accuracy must be a valid number" },
  )
  @Min(0)
  accuracy?: number;

  @Expose()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewDto {
  @Expose() @IsString() @IsNotEmpty() reviewToken!: string;
  @Expose() @IsInt() @Min(1) @Max(5) rating!: number;
  @Expose() @IsOptional() @IsString() comment?: string;
}

export class ComplaintDto {
  @Expose() @IsEnum(VendorComplaintCategory) category!: VendorComplaintCategory;
  @Expose() @IsString() @IsNotEmpty() subject!: string;
  @Expose() @IsString() @IsNotEmpty() description!: string;
}

export class CommissionConfigDto {
  @Expose() @IsNumber() @Min(0) @Max(100) percentage!: number;
}

export class VendorCreateLeadDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @Expose()
  @IsOptional()
  @IsEmail()
  email?: string;

  @Expose()
  @IsOptional()
  @IsString()
  address?: string;

  @Expose()
  @IsOptional()
  @IsString()
  district?: string;

  @Expose()
  @IsOptional()
  @IsString()
  pincode?: string;

  @Expose()
  @IsOptional()
  @IsString()
  specialization?: string;

  @Expose()
  @IsOptional()
  @IsString()
  serviceType?: string;

  @Expose()
  @IsOptional()
  @IsString()
  issue?: string;

  @Expose()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedAmount?: number;
}

export class ProductPurchaseDto {
  @Expose() @IsString() @IsNotEmpty() productId!: string;
  @Expose() @IsInt() @Min(1) quantity!: number;
}

export class PartPurchaseDto {
  @Expose() @IsString() @IsNotEmpty() partId!: string;
  @Expose() @IsInt() @Min(1) quantity!: number;
}

export class PurchaseProductDto {
  @Expose() @IsString() @IsNotEmpty() productId!: string;
  @Expose() @IsInt() @Min(1) quantity!: number;
}

export class PurchasePartDto {
  @Expose() @IsString() @IsNotEmpty() partId!: string;
  @Expose() @IsInt() @Min(1) quantity!: number;
}