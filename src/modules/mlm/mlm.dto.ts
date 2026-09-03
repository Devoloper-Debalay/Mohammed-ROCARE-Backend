import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { WithdrawalStatus } from "../../generated/prisma/enums";
import { PaginationDto } from "../admin/admin.dto";

export class CreateWithdrawalRequestDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  amount!: number;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  ifsc?: string;

  @IsOptional()
  @IsString()
  upiId?: string;
}

export class ReviewWithdrawalDto {
  @IsEnum(WithdrawalStatus)
  status!: WithdrawalStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  transactionRef?: string;
}

export class CommissionQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  commissionType?: string;
}
