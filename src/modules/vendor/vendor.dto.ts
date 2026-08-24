import { Expose } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { VendorComplaintCategory } from "../../generated/prisma/enums";

export class UpdateVendorProfileDto {

  @Expose()
  @IsString()
  @IsNotEmpty({ message: "vendorCode is required." })
  vendorCode!: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

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
  specialization?: string;
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

  // aadhaarFrontImage / aadhaarBackImage / panImage come from multer file
  // uploads in the router, not the JSON body — see vendor.router.ts.
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
  @MaxLength(72) // bcrypt's effective input limit
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
  @Expose() @IsOptional() @IsNumber() latitude?: number;
  @Expose() @IsOptional() @IsNumber() longitude?: number;
  @Expose() @IsOptional() @IsNumber() accuracy?: number;
  @Expose() @IsOptional() @IsString() reason?: string;
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