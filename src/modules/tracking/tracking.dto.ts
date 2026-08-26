import { IsLatitude, IsLongitude, IsNumber, IsOptional } from "class-validator";
export class LocationDto { @IsLatitude() latitude!: number; @IsLongitude() longitude!: number; @IsOptional() @IsNumber() accuracy?: number; }
