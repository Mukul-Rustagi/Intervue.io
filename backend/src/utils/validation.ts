import { z } from "zod";

export const createPollSchema = z.object({
  question: z.string().trim().min(5, "Question must be at least 5 characters").max(280),
  options: z
    .array(z.string().trim().min(1, "Option cannot be empty").max(200))
    .min(2, "At least 2 options are required")
    .max(6, "Maximum 6 options are allowed"),
  durationSeconds: z.number().int().min(10).max(60)
});

export const registerSchema = z
  .object({
    role: z.enum(["teacher", "student"]),
    sessionId: z.string().trim().min(5),
    name: z.string().trim().min(2).max(80).optional()
  })
  .superRefine((value, context) => {
    if (value.role === "student" && !value.name) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Student name is required"
      });
    }
  });

export const voteSchema = z.object({
  pollId: z.string().trim().min(1),
  optionId: z.string().trim().min(1)
});

export const removeStudentSchema = z.object({
  sessionId: z.string().trim().min(1, "student sessionId is required.")
});

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(500)
});
