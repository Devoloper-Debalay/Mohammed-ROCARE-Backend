import { injectable, inject } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { VendorAuthService } from "./vendor-auth.service";
import { sendSuccess } from "../../../shared/response";

@injectable()
export class VendorAuthController {
  constructor(@inject(VendorAuthService) private readonly authService: VendorAuthService) { }

  signup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.signup(req.body);
      sendSuccess(res, result, "Signup successful. Verify your phone to continue.", 201);
    } catch (err) {
      next(err);
    }
  };

  sendOtp = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { identifier, purpose } = req.body;

      const result =
        await this.authService.sendOtp(
          identifier,
          purpose
        );

      sendSuccess(
        res,
        result,
        "OTP sent."
      );
    } catch (err) {
      next(err);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, code, purpose } = req.body;

      const result = await this.authService.verifyOtp(
        identifier,
        code,
        purpose
      );

      sendSuccess(res, result, "OTP verified successfully.");
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, password } = req.body;
      const result = await this.authService.login(identifier, password);
      sendSuccess(res, result, "Login successful.");
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.authService.refreshToken(refreshToken);
      sendSuccess(res, result, "Token refreshed.");
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw createHttpError(401, "No token provided.");
      }
      const accessToken = authHeader.split(" ")[1];
      const { refreshToken } = req.body;

      await this.authService.logout(accessToken, refreshToken);
      sendSuccess(res, undefined, "Logged out successfully.");
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier } = req.body;

      const result = await this.authService.forgotPassword(identifier);

      sendSuccess(res, result, "OTP sent successfully.");
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, code, newPassword } = req.body;

      await this.authService.resetPassword(identifier, code, newPassword);

      sendSuccess(res, undefined, "Password reset successfully.");
    } catch (err) {
      next(err);
    }
  };
}
