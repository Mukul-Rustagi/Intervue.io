import { EventEmitter } from "node:events";

import { Types } from "mongoose";

import { isDatabaseConnected } from "../config/database.js";
import { PollModel, type PollDocument } from "../models/Poll.js";
import { VoteModel } from "../models/Vote.js";
import type {
  ChatMessageView,
  PollEndReason,
  PollOptionView,
  PollSnapshot,
  StudentState,
  TeacherState
} from "../types/domain.js";
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError
} from "../utils/errors.js";
import { StudentRegistryService } from "./StudentRegistryService.js";

interface CreatePollInput {
  question: string;
  options: string[];
  durationSeconds: number;
  createdBySessionId: string;
}

interface SubmitVoteInput {
  pollId: string;
  optionId: string;
  studentSessionId: string;
  studentName: string;
}

export class PollService extends EventEmitter {
  private readonly pollTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly studentRegistry: StudentRegistryService,
    private readonly maxPollDurationSeconds: number
  ) {
    super();
  }

  public async bootstrap(): Promise<void> {
    if (!isDatabaseConnected()) {
      return;
    }

    const activePolls = await PollModel.find({ status: "active" }).sort({ startedAt: -1 });

    const [latest, ...stale] = activePolls;

    for (const poll of stale) {
      await this.closePollInternal(poll.id, "manual", false);
    }

    if (!latest) {
      return;
    }

    const now = Date.now();
    if (latest.expiresAt.getTime() <= now) {
      await this.closePollInternal(latest.id, "timer", false);
      return;
    }

    this.schedulePollTimer(latest.id, latest.expiresAt);
  }

  public async createPoll(input: CreatePollInput): Promise<PollSnapshot> {
    this.assertDatabaseReady();

    const normalizedQuestion = input.question.trim();
    const normalizedOptions = input.options.map((option) => option.trim()).filter(Boolean);

    if (normalizedOptions.length < 2 || normalizedOptions.length > 6) {
      throw new ValidationError("Please provide 2 to 6 options.");
    }

    const uniqueOptions = new Set(normalizedOptions.map((option) => option.toLowerCase()));
    if (uniqueOptions.size !== normalizedOptions.length) {
      throw new ValidationError("Options must be unique.");
    }

    if (input.durationSeconds < 10 || input.durationSeconds > this.maxPollDurationSeconds) {
      throw new ValidationError(
        `Duration must be between 10 and ${this.maxPollDurationSeconds} seconds.`
      );
    }

    const activePoll = await this.syncActivePollWithClock();
    if (activePoll) {
      throw new ConflictError("An active poll is already running.");
    }
    await this.assertCanCreateNextPoll();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.durationSeconds * 1000);

    const createdPoll = await PollModel.create({
      question: normalizedQuestion,
      options: normalizedOptions.map((text) => ({ text })),
      durationSeconds: input.durationSeconds,
      startedAt: now,
      expiresAt,
      status: "active",
      createdBySessionId: input.createdBySessionId
    });

    this.schedulePollTimer(createdPoll.id, expiresAt);
    await this.emitStateChanged();

    return this.serializePoll(createdPoll);
  }

  public async submitVote(input: SubmitVoteInput): Promise<{ poll: PollSnapshot; selectedOptionId: string }> {
    this.assertDatabaseReady();

    const activePoll = await this.syncActivePollWithClock();
    if (!activePoll || activePoll.id !== input.pollId) {
      throw new ConflictError("No active poll is available for voting.");
    }

    const optionExists = activePoll.options.some((option) => option.optionId === input.optionId);
    if (!optionExists) {
      throw new ValidationError("Invalid option selected.");
    }

    try {
      await VoteModel.create({
        pollId: new Types.ObjectId(input.pollId),
        optionId: input.optionId,
        studentSessionId: input.studentSessionId,
        studentName: input.studentName.trim()
      });
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code === 11000) {
        throw new ConflictError("You have already voted for this question.");
      }

      throw error;
    }

    await PollModel.updateOne(
      {
        _id: activePoll.id,
        status: "active",
        "options.optionId": input.optionId
      },
      {
        $inc: {
          "options.$.voteCount": 1
        }
      }
    );

    await this.reconcileActivePollWithParticipants(false);

    const latestPoll = await this.getActivePollOrLatestClosed();
    if (!latestPoll) {
      throw new NotFoundError("Unable to fetch poll state after voting.");
    }

    await this.emitStateChanged();

    return {
      poll: this.serializePoll(latestPoll),
      selectedOptionId: input.optionId
    };
  }

  public async reconcileActivePollWithParticipants(emitState = true): Promise<void> {
    if (!isDatabaseConnected()) {
      return;
    }

    const activePoll = await this.syncActivePollWithClock();
    if (!activePoll) {
      return;
    }

    const connectedStudents = this.studentRegistry.getConnectedStudentCount();
    if (connectedStudents === 0) {
      return;
    }

    const totalVotes = await VoteModel.countDocuments({ pollId: activePoll._id });
    if (totalVotes >= connectedStudents) {
      await this.closePollInternal(activePoll.id, "all_answered", false);
      if (emitState) {
        await this.emitStateChanged();
      }
    }
  }

  public async getTeacherState(chatMessages: ChatMessageView[]): Promise<TeacherState> {
    const fallback: TeacherState = {
      role: "teacher",
      serverTime: new Date().toISOString(),
      activePoll: null,
      canCreateNextPoll: true,
      connectedStudents: this.studentRegistry.getConnectedStudents(),
      pollHistory: [],
      chatMessages
    };

    if (!isDatabaseConnected()) {
      return fallback;
    }

    const activePoll = await this.syncActivePollWithClock();
    const latestClosedPoll = await PollModel.findOne({ status: "closed" }).sort({ endedAt: -1 });
    const pollHistory = await this.getPollHistory(15);
    const canCreateNextPoll = !activePoll && (await this.canCreateNextPoll(latestClosedPoll));

    return {
      ...fallback,
      activePoll: activePoll ? this.serializePoll(activePoll) : null,
      canCreateNextPoll,
      pollHistory
    };
  }

  public async getStudentState(sessionId: string, chatMessages: ChatMessageView[]): Promise<StudentState> {
    const fallback: StudentState = {
      role: "student",
      serverTime: new Date().toISOString(),
      activePoll: null,
      hasAnsweredCurrentPoll: false,
      selectedOptionId: null,
      latestClosedPoll: null,
      chatMessages
    };

    if (!isDatabaseConnected()) {
      return fallback;
    }

    const activePoll = await this.syncActivePollWithClock();

    if (activePoll) {
      const existingVote = await VoteModel.findOne({
        pollId: activePoll._id,
        studentSessionId: sessionId
      }).lean();

      return {
        ...fallback,
        activePoll: this.serializePoll(activePoll),
        hasAnsweredCurrentPoll: Boolean(existingVote),
        selectedOptionId: existingVote?.optionId ?? null
      };
    }

    const latestClosedPoll = await PollModel.findOne({ status: "closed" }).sort({ endedAt: -1 });
    return {
      ...fallback,
      latestClosedPoll: latestClosedPoll ? this.serializePoll(latestClosedPoll) : null
    };
  }

  public async getPollHistory(limit = 20): Promise<PollSnapshot[]> {
    if (!isDatabaseConnected()) {
      return [];
    }

    const polls = await PollModel.find({ status: "closed" }).sort({ endedAt: -1 }).limit(limit);
    return polls.map((poll) => this.serializePoll(poll));
  }

  public async forceCloseCurrentPoll(reason: PollEndReason = "manual"): Promise<void> {
    this.assertDatabaseReady();

    const activePoll = await this.syncActivePollWithClock();
    if (!activePoll) {
      throw new NotFoundError("No active poll to close.");
    }

    await this.closePollInternal(activePoll.id, reason, false);
    await this.emitStateChanged();
  }

  private async emitStateChanged(): Promise<void> {
    this.emit("stateChanged");
  }

  private assertDatabaseReady(): void {
    if (!isDatabaseConnected()) {
      throw new ServiceUnavailableError();
    }
  }

  private async getActivePollOrLatestClosed(): Promise<PollDocument | null> {
    const active = await this.syncActivePollWithClock();
    if (active) {
      return active;
    }

    return PollModel.findOne({ status: "closed" }).sort({ endedAt: -1 });
  }

  private async assertCanCreateNextPoll(): Promise<void> {
    const latestClosedPoll = await PollModel.findOne({ status: "closed" }).sort({ endedAt: -1 });
    const allowed = await this.canCreateNextPoll(latestClosedPoll);
    if (allowed) {
      return;
    }

    throw new ConflictError(
      "You can ask a new question only after all connected students answer the previous one."
    );
  }

  private async canCreateNextPoll(latestClosedPoll: PollDocument | null): Promise<boolean> {
    const connectedStudents = this.studentRegistry.getConnectedStudents();
    if (connectedStudents.length === 0) {
      return true;
    }

    if (!latestClosedPoll) {
      return true;
    }

    if (latestClosedPoll.endReason === "all_answered") {
      return true;
    }

    const connectedSessionIds = connectedStudents.map((student) => student.sessionId);
    const votedConnectedStudents = await VoteModel.countDocuments({
      pollId: latestClosedPoll._id,
      studentSessionId: {
        $in: connectedSessionIds
      }
    });

    return votedConnectedStudents === connectedSessionIds.length;
  }

  private async syncActivePollWithClock(): Promise<PollDocument | null> {
    if (!isDatabaseConnected()) {
      return null;
    }

    const activePolls = await PollModel.find({ status: "active" }).sort({ startedAt: -1 });
    if (activePolls.length === 0) {
      return null;
    }

    const [latest, ...stale] = activePolls;

    for (const poll of stale) {
      await this.closePollInternal(poll.id, "manual", false);
    }

    if (latest.expiresAt.getTime() <= Date.now()) {
      await this.closePollInternal(latest.id, "timer", false);
      return null;
    }

    this.schedulePollTimer(latest.id, latest.expiresAt);
    return latest;
  }

  private async closePollInternal(
    pollId: string,
    reason: PollEndReason,
    emitState: boolean
  ): Promise<void> {
    this.clearPollTimer(pollId);

    await PollModel.updateOne(
      {
        _id: new Types.ObjectId(pollId),
        status: "active"
      },
      {
        $set: {
          status: "closed",
          endedAt: new Date(),
          endReason: reason
        }
      }
    );

    if (emitState) {
      await this.emitStateChanged();
    }
  }

  private schedulePollTimer(pollId: string, expiresAt: Date): void {
    const duration = expiresAt.getTime() - Date.now();
    this.clearPollTimer(pollId);

    if (duration <= 0) {
      void this.closePollInternal(pollId, "timer", true);
      return;
    }

    const timer = setTimeout(() => {
      void this.closePollInternal(pollId, "timer", true);
    }, duration);

    timer.unref();
    this.pollTimers.set(pollId, timer);
  }

  private clearPollTimer(pollId: string): void {
    const existing = this.pollTimers.get(pollId);
    if (!existing) {
      return;
    }

    clearTimeout(existing);
    this.pollTimers.delete(pollId);
  }

  private serializePoll(poll: PollDocument): PollSnapshot {
    const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);

    const options: PollOptionView[] = poll.options.map((option) => {
      const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
      return {
        optionId: option.optionId,
        text: option.text,
        voteCount: option.voteCount,
        percentage
      };
    });

    return {
      id: poll.id,
      question: poll.question,
      options,
      durationSeconds: poll.durationSeconds,
      startedAt: poll.startedAt.toISOString(),
      expiresAt: poll.expiresAt.toISOString(),
      status: poll.status,
      endReason: poll.endReason ?? null,
      totalVotes
    };
  }
}
