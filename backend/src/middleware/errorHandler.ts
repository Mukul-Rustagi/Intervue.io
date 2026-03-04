import type { NextFunction, Request, Response } from "express";
import { Error as MongooseError } from "mongoose";
import { ZodError } from "zod";

import { AppError } from "../utils/errors.js";

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: error.issues.map((issue) => issue.message).join("; ")
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof MongooseError) {
    res.status(503).json({ message: "Database operation failed. Please retry." });
    return;
  }

  const unexpected = error as Error;
  console.error("Unhandled error", unexpected);
  res.status(500).json({ message: "Unexpected server error." });
};
