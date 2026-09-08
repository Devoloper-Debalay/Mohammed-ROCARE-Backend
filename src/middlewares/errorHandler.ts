import { ErrorRequestHandler } from "express";
import { ResponseBody } from "../base/interface";

/**
 * Some SDKs (e.g. Razorpay) reject with a plain object like
 * `{ statusCode, error: { description, code, ... } }` instead of an Error
 * instance — those have no `.message`, so without this they'd silently
 * collapse to a useless "Internal Server Error".
 */
function extractMessage(err: any): string | undefined {
  if (err?.message) return err.message;
  if (err?.error?.description) return err.error.description;
  if (typeof err?.error === "string") return err.error;
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error(err.stack || err); // Log the error for debugging purposes

    const statusCode = err.statusCode || 500;
    const errorMessage = extractMessage(err) || 'Internal Server Error';
    const response: ResponseBody = {
        success: false,
        message: errorMessage
    }
    res.status(statusCode).json({...response});
  }