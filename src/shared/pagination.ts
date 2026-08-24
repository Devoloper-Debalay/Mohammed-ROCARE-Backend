import { Request } from "express";

export function page(req: Request): number {
  const value = Number(req.query.page);
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 1;
}

export function limit(req: Request): number {
  const value = Number(req.query.limit);
  return Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), 100)
    : 10;
}