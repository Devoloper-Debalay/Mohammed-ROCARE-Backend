import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from "class-validator";

export class CustomerSignupDto {
  @IsString() @IsNotEmpty() @MaxLength(80) firstName!: string;
  @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) lastName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsOptional() @IsString() referralCode?: string; // Optional referral code on signup
}

export class CustomerOtpDto {
  @IsString() @IsNotEmpty() identifier!: string;
  @IsIn(["SIGNUP", "LOGIN"]) purpose!: "SIGNUP" | "LOGIN";
}

export class CustomerVerifyOtpDto {
  @IsString() @IsNotEmpty() identifier!: string;
  @IsString() @Length(6, 6) code!: string;
  @IsIn(["SIGNUP", "LOGIN"]) purpose!: "SIGNUP" | "LOGIN";
}

export class CustomerAddressDto {
  @IsString() @IsNotEmpty() label!: string;
  @IsString() @IsNotEmpty() line1!: string;
  @IsOptional() @IsString() line2?: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsNotEmpty() state!: string;
  @IsString() @IsNotEmpty() pincode!: string;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
  @IsOptional() isDefault?: boolean;
}

export class CustomerCreateLeadDto {
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() specialization?: string;
  @IsOptional() @IsString() serviceType?: string;
  @IsOptional() @IsString() issue?: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) estimatedAmount?: number;
}
