import { IsNumber, IsOptional, IsString, Min } from "class-validator";
export class WalletRechargeDto { @IsNumber() @Min(1) amount!: number; }
export class WalletWithdrawalDto { @IsNumber() @Min(1) amount!: number; @IsOptional() @IsString() note?: string; }
export class WalletIssueDto { @IsString() subject!: string; @IsString() description!: string; }
