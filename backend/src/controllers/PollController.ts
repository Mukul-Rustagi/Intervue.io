import type { Request, Response } from "express";

import { ChatService } from "../services/ChatService.js";
import { PollService } from "../services/PollService.js";
import { createPollSchema, voteSchema } from "../utils/validation.js";
import { ValidationError } from "../utils/errors.js";

export class PollController {
  constructor(
    private readonly pollService: PollService,
    private readonly chatService: ChatService
  ) {}

  public getState = async (req: Request, res: Response): Promise<void> => {
    const role = `${req.query.role ?? ""}`.trim();
    const sessionId = `${req.query.sessionId ?? ""}`.trim();

    const chatMessages = await this.chatService.getRecentMessages();

    if (role === "teacher") {
      const state = await this.pollService.getTeacherState(chatMessages);
      res.json(state);
      return;
    }

    if (role === "student") {
      if (!sessionId) {
        throw new ValidationError("sessionId is required for student state.");
      }

      const state = await this.pollService.getStudentState(sessionId, chatMessages);
      res.json(state);
      return;
    }

    throw new ValidationError("role query param must be either teacher or student.");
  };

  public getHistory = async (_req: Request, res: Response): Promise<void> => {
    const polls = await this.pollService.getPollHistory(20);
    res.json({ polls });
  };

  public createPoll = async (req: Request, res: Response): Promise<void> => {
    const body = createPollSchema.parse(req.body);
    const createdBySessionId = `${req.body.createdBySessionId ?? "teacher-rest"}`.trim();

    const poll = await this.pollService.createPoll({
      question: body.question,
      options: body.options,
      durationSeconds: body.durationSeconds,
      createdBySessionId
    });

    res.status(201).json({ poll });
  };

  public submitVote = async (req: Request, res: Response): Promise<void> => {
    const body = voteSchema.parse({
      pollId: req.params.pollId,
      optionId: req.body.optionId
    });

    const studentSessionId = `${req.body.studentSessionId ?? ""}`.trim();
    const studentName = `${req.body.studentName ?? ""}`.trim();

    if (!studentSessionId || !studentName) {
      throw new ValidationError("studentSessionId and studentName are required.");
    }

    const result = await this.pollService.submitVote({
      pollId: body.pollId,
      optionId: body.optionId,
      studentSessionId,
      studentName
    });

    res.status(201).json(result);
  };
}
