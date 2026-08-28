import { Expose } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class VendorSignupDto {
  @Expose()
  @IsIn(["AGENT", "TECHNICIAN"], { message: "role must be AGENT or TECHNICIAN." })
  role!: "AGENT" | "TECHNICIAN";

  @Expose()
  @IsString()
  @IsNotEmpty({ message: "fullName is required." })
  @MaxLength(120)
  fullName!: string;

  @Expose()
  @IsString()
  @Length(10, 15, { message: "phone must be a valid phone number." })
  phone!: string;

  @Expose()
  @IsOptional()
  @IsEmail({}, { message: "email must be a valid email address." })
  email?: string;

  @Expose()
  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters." })
  @MaxLength(72)
  password!: string;

  @Expose()
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class VendorLoginDto {
  /** Email address or phone number. */
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "Email or phone is required." })
  identifier!: string;

  @Expose()
  @IsString()
  @IsNotEmpty({ message: "password is required." })
  password!: string;
}

export class SendOtpDto {
  @Expose()
  @IsString()
  @IsNotEmpty({
    message: "Email or phone is required.",
  })
  identifier!: string;

  @Expose()
  @IsIn(
    ["SIGNUP", "LOGIN", "RESET_PASSWORD"],
    {
      message: "invalid purpose.",
    }
  )
  purpose!: "SIGNUP" | "LOGIN" | "RESET_PASSWORD";
}

export class VerifyOtpDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "Email or phone is required." })
  identifier!: string;

  @Expose()
  @IsString()
  @Length(6, 6)
  code!: string;

  @Expose()
  @IsIn(["SIGNUP", "LOGIN", "RESET_PASSWORD"])
  purpose!: "SIGNUP" | "LOGIN" | "RESET_PASSWORD";
}

export class RefreshTokenDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "refreshToken is required." })
  refreshToken!: string;
}

export class LogoutDto {
  @Expose()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "Email or phone is required." })
  identifier!: string;
}

export class ResetPasswordDto {
  @Expose()
  @IsString()
  @IsNotEmpty({ message: "Email or phone is required." })
  identifier!: string;

  @Expose()
  @IsString()
  @Length(6, 6)
  code!: string;

  @Expose()
  @IsString()
  @MinLength(8, { message: "newPassword must be at least 8 characters." })
  @MaxLength(72)
  newPassword!: string;
}
