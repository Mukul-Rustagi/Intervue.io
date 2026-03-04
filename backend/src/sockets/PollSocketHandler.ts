import type { Server, Socket } from "socket.io";
import { ZodError } from "zod";

import type { UserRole } from "../types/domain.js";
import { AppError, ForbiddenError, ValidationError } from "../utils/errors.js";
import {
  chatMessageSchema,
  createPollSchema,
  removeStudentSchema,
  registerSchema,
  voteSchema
} from "../utils/validation.js";
import { ChatService } from "../services/ChatService.js";
import { ModerationService } from "../services/ModerationService.js";
import { PollService } from "../services/PollService.js";
import { StudentRegistryService } from "../services/StudentRegistryService.js";

interface ConnectionMeta {
  role: UserRole;
  sessionId: string;
  name: string;
}

export class PollSocketHandler {
  private readonly connections = new Map<string, ConnectionMeta>();

  constructor(
    private readonly io: Server,
    private readonly pollService: PollService,
    private readonly chatService: ChatService,
    private readonly studentRegistry: StudentRegistryService,
    private readonly moderationService: ModerationService
  ) {
    this.pollService.on("stateChanged", () => {
      void this.broadcastStateToAll();
    });

    this.studentRegistry.on("updated", () => {
      void (async () => {
        await this.pollService.reconcileActivePollWithParticipants(false);
        await this.broadcastStateToAll();
      })();
    });
  }

  public register(): void {
    this.io.on("connection", (socket) => {
      this.registerConnectionHandlers(socket);
    });
  }

  private registerConnectionHandlers(socket: Socket): void {
    socket.on("session:register", async (rawPayload: unknown) => {
      await this.handleOperation(socket, async () => {
        const payload = registerSchema.parse(rawPayload);
        const role = payload.role;
        const name = role === "teacher" ? "Teacher" : payload.name ?? "Student";

        const meta: ConnectionMeta = {
          role,
          sessionId: payload.sessionId,
          name
        };

        this.connections.set(socket.id, meta);
        socket.join(role === "teacher" ? "teachers" : "students");

        if (role === "student") {
          this.studentRegistry.registerStudent(payload.sessionId, name, socket.id);
        }

        await this.sendStateToSocket(socket.id, meta);
      });
    });

    socket.on("state:request", async () => {
      await this.handleOperation(socket, async () => {
        const meta = this.requireMeta(socket.id);
        await this.sendStateToSocket(socket.id, meta);
      });
    });

    socket.on("poll:create", async (rawPayload: unknown) => {
      await this.handleOperation(socket, async () => {
        const meta = this.requireMeta(socket.id);
        if (meta.role !== "teacher") {
          throw new ForbiddenError("Only teacher can create polls.");
        }

        const payload = createPollSchema.parse(rawPayload);

        await this.pollService.createPoll({
          question: payload.question,
          options: payload.options,
          durationSeconds: payload.durationSeconds,
          createdBySessionId: meta.sessionId
        });

        socket.emit("operation:success", {
          type: "poll:create",
          message: "Poll started successfully."
        });
      });
    });

    socket.on("poll:vote", async (rawPayload: unknown) => {
      await this.handleOperation(socket, async () => {
        const meta = this.requireMeta(socket.id);
        if (meta.role !== "student") {
          throw new ForbiddenError("Only students can vote.");
        }

        const payload = voteSchema.parse(rawPayload);

        await this.pollService.submitVote({
          pollId: payload.pollId,
          optionId: payload.optionId,
          studentSessionId: meta.sessionId,
          studentName: meta.name
        });

        socket.emit("vote:accepted", {
          pollId: payload.pollId,
          optionId: payload.optionId
        });
      });
    });

    socket.on("poll:close", async () => {
      await this.handleOperation(socket, async () => {
        const meta = this.requireMeta(socket.id);
        if (meta.role !== "teacher") {
          throw new ForbiddenError("Only teacher can close active polls.");
        }

        await this.pollService.forceCloseCurrentPoll("manual");
        socket.emit("operation:success", {
          type: "poll:close",
          message: "Poll closed successfully."
        });
      });
    });

    socket.on("student:remove", async (rawPayload: unknown) => {
      await this.handleOperation(socket, async () => {
        const meta = this.requireMeta(socket.id);
        if (meta.role !== "teacher") {
          throw new ForbiddenError("Only teacher can remove students.");
        }

        const payload = removeStudentSchema.parse(rawPayload);
        const socketIds = this.moderationService.removeStudent(payload.sessionId);
        this.disconnectRemovedStudents(socketIds);
      });
    });

    socket.on("chat:send", async (rawPayload: unknown) => {
      await this.handleOperation(socket, async () => {
        const meta = this.requireMeta(socket.id);
        const payload = chatMessageSchema.parse(rawPayload);

        await this.chatService.createMessage({
          role: meta.role,
          sessionId: meta.sessionId,
          senderName: meta.name,
          message: payload.message
        });

        await this.broadcastStateToAll();
      });
    });

    socket.on("disconnect", () => {
      const meta = this.connections.get(socket.id);
      if (meta?.role === "student") {
        this.studentRegistry.unregisterSocket(socket.id);
      }

      this.connections.delete(socket.id);
    });
  }

  private requireMeta(socketId: string): ConnectionMeta {
    const meta = this.connections.get(socketId);
    if (!meta) {
      throw new ValidationError("Session not registered. Please reconnect.");
    }

    return meta;
  }

  private disconnectRemovedStudents(socketIds: string[]): void {
    for (const targetSocketId of socketIds) {
      const targetSocket = this.io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) {
        continue;
      }

      targetSocket.emit("session:removed", {
        message: "Teacher removed you from this live poll room."
      });
      targetSocket.disconnect(true);
    }
  }

  private async sendStateToSocket(socketId: string, meta: ConnectionMeta): Promise<void> {
    const chatMessages = await this.chatService.getRecentMessages();

    if (meta.role === "teacher") {
      const teacherState = await this.pollService.getTeacherState(chatMessages);
      this.io.to(socketId).emit("state:sync", teacherState);
      return;
    }

    const studentState = await this.pollService.getStudentState(meta.sessionId, chatMessages);
    this.io.to(socketId).emit("state:sync", studentState);
  }

  private async broadcastStateToAll(): Promise<void> {
    const chatMessages = await this.chatService.getRecentMessages();

    const teacherState = await this.pollService.getTeacherState(chatMessages);
    this.io.to("teachers").emit("state:sync", teacherState);

    const studentSockets = [...this.connections.entries()].filter(([, meta]) => meta.role === "student");

    await Promise.all(
      studentSockets.map(async ([socketId, meta]) => {
        const state = await this.pollService.getStudentState(meta.sessionId, chatMessages);
        this.io.to(socketId).emit("state:sync", state);
      })
    );
  }

  private async handleOperation(socket: Socket, operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      const message = this.extractMessage(error);
      socket.emit("operation:error", { message });
    }
  }

  private extractMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof ZodError) {
      return error.issues.map((issue) => issue.message).join("; ");
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unexpected server error.";
  }
}
