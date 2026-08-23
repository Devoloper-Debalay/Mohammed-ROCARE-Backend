import { Request, Response } from "express";
import { ResponseBody } from "../base/interface";

export function responseHandler(req: Request, res: Response): void {
  const response: ResponseBody = {
    success: true,
    message: req.body
  }
  res.status(200).send(response)
}