import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  MinLength,
  IsDateString,
} from "class-validator";
import { OrderStatus, PaymentStatus, ProductCategory, Role, ServiceCategory } from "../../generated/prisma/enums";

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class VendorDecisionDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignBranchDto {
  @IsUUID()
  branchId!: string;
}

export class OrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class PaymentDecisionDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class ProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class ServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UserRoleDto {
  @IsEnum(Role)
  role!: Role;
}

export class AdminRoleDto {
  @IsEnum(Role)
  role!: Extract<Role, "ADMIN" | "SADMIN">;
}

export class UpdateAdminDto {
  @IsOptional() @IsString() @IsNotEmpty() firstName?: string;
  @IsOptional() @IsString() @IsNotEmpty() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUUID() branchId?: string | null;
  @IsOptional() @IsString() jobTitle?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetAdminPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class AuditLogQueryDto extends PaginationDto {
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}

export class BranchDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SettingDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsNotEmpty()
  value!: unknown;

  @IsOptional()
  @IsString()
  description?: string;
}


export class WalletAdjustmentDto {
  @IsUUID()
  vendorId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ComplaintReplyDto {
  @IsString()
  @IsNotEmpty()
  reply!: string;

  @IsOptional()
  @IsString()
  status?: string;
}
