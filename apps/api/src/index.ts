/**
 * @module api-server
 * @description OpenClaw API server — RESTful endpoints for agent execution and token payment
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { agentRoutes } from "./routes/agent";
import { paymentRoutes } from "./routes/payment";
import { modelRoutes } from "./routes/models";
import { healthRoutes } from "./routes/health";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/models", modelRoutes);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[API Error]", err.message);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OpenClaw API] Server running on port ${PORT}`);
  console.log(`[OpenClaw API] Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
