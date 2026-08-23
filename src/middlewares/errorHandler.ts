import { ErrorRequestHandler } from "express";
import { ResponseBody } from "../base/interface";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error(err.stack); // Log the error for debugging purposes
  
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || 'Internal Server Error';
    const response: ResponseBody = {
        success: false,
        message: errorMessage
    }
    res.status(statusCode).json({...response});
  }