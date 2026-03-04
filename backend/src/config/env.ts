import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  MAX_POLL_DURATION_SECONDS: z.coerce.number().int().min(10).max(60).default(60)
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
