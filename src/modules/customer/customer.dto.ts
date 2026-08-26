import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CustomerSignupDto {
  @IsString() @IsNotEmpty() @MaxLength(80) firstName!: string;
  @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) lastName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @IsNotEmpty() phone!: string;
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
