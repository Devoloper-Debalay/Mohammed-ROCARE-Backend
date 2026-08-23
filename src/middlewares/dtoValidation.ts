import { ValidationError, validate } from "class-validator";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { plainToInstance } from "class-transformer";

function formatErrors(errors: ValidationError[], parent = ""): any[] {
  return errors.flatMap((err) => {
    const field = parent ? `${parent}.${err.property}` : err.property;

    if (err.constraints) {
      return [{ field, errors: Object.values(err.constraints) }];
    }

    if (err.children && err.children.length > 0) {
      return formatErrors(err.children, field);
    }

    return [];
  });
}

export function dtoValidation(type: any): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObj = plainToInstance(type, req.body);
    const errors: ValidationError[] = await validate(dtoObj);

    if (errors.length > 0) {
      res.status(400).json({ message: formatErrors(errors) });
    } else {
      req.body = dtoObj;
      next();
    }
  };
}