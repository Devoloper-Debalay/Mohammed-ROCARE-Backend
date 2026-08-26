import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
export class CreateServiceRequestDto {
  @IsUUID() serviceId!: string;
  @IsOptional() @IsUUID() addressId?: string;
  @IsOptional() @IsInt() @Min(0) priority?: number;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() notes?: string;
}
export class ScheduleServiceRequestDto { @IsOptional() @IsDateString() scheduledAt?: string; }
export class AssignServiceRequestDto { @IsUUID() vendorId!: string; }
