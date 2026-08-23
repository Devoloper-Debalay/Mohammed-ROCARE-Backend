import "reflect-metadata";
import express, { Request, Response, json, urlencoded } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/errorHandler";
import { responseHandler } from "./middlewares/responseHandler";
import mainRouter from "./base/base.router";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { scheduleTokenCleanup } from "./utils/tokenCleanup";

dotenv.config();

scheduleTokenCleanup();

const app = express();

// Core Middlewares
app.use(helmet())
app.use(cors())
app.use(json());
app.use(cors());
app.use(urlencoded({ extended: true }));
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 100)
});
app.use(limiter);

// app.use((req, res, next) => {
//   console.log("REQ ARRIVED:", req.method, req.path, req.body);
//   next();
// }); // We can uncomment this for debugging purposes, for Router level logging use middleware in the router files

// API Routes
app.use("/api", mainRouter);

// Health Check Endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "ROCARE Backend API is up and running 🚀",
  });
});

// Global Handlers
app.use(errorHandler);
app.use(responseHandler);

export default app;
