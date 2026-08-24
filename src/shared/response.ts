import { Response } from "express";

/**
 * Superset of base/interface.ts's ResponseBody ({ success, message }) —
 * adds `data`/`pagination` for the new modules without touching the
 * existing type (kept as-is for backward compatibility with older routes).
 */
export interface ApiSuccessBody<T = unknown> {
  success: true;
  message: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message = "Success",
  statusCode = 200,
  pagination?: ApiSuccessBody["pagination"]
): void {
  const body: ApiSuccessBody<T> = { success: true, message, data, pagination };
  res.status(statusCode).json(body);
}
