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

app.set("trust proxy", 1);

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
//
// Passenger/LiteSpeed on cPanel does NOT strip the app's registered base URI
// from the incoming path — req.path arrives as the full public URL path
// (e.g. "/ecommerce/api/catalog/products"), not stripped down to "/catalog/products"
// the way it would be behind a typical Passenger reverse proxy. So the mount
// prefix has to match wherever this app is actually deployed publicly.
const API_PREFIX = process.env.API_PREFIX || "/api";
app.use(API_PREFIX, mainRouter);

// Health Check Endpoint — registered at both "/" (domain-root deployments)
// and the actual API prefix (subdirectory deployments like /ecommerce/api).
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Just24You Backend API is up and running 🚀",
  });
});
if (API_PREFIX !== "/") {
  app.get(API_PREFIX, (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Just24You Backend API is up and running 🚀",
    });
  });
}

// Global Handlers
app.use(errorHandler);
app.use(responseHandler);

export default app;
