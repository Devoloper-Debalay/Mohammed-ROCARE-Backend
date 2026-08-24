import "reflect-metadata";
import { container } from "tsyringe";
import prisma from "./config/database";
import type { PrismaClient } from "./generated/prisma/client";

/**
 * Central DI container.
 *
 * Repositories/services register themselves with @injectable() and pull
 * their dependencies with @inject(...) — this file just wires the one
 * thing that can't self-register: the shared PrismaClient instance from
 * config/database.ts (kept as a singleton to reuse the Neon connection).
 *
 * Import this file once, early (e.g. top of app.ts), before any module
 * that resolves things out of the container.
 */
container.register<PrismaClient>("PrismaClient", { useValue: prisma });

export { container };
