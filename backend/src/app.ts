import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createPollRouter } from "./routes/pollRoutes.js";
import { PollController } from "./controllers/PollController.js";

export const createApp = (pollController: PollController) => {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", serverTime: new Date().toISOString() });
  });

  app.use("/api", createPollRouter(pollController));

  app.use(errorHandler);

  return app;
};
