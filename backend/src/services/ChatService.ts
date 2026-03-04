import { isDatabaseConnected } from "../config/database.js";
import { ChatMessageModel } from "../models/ChatMessage.js";
import type { ChatMessageView, UserRole } from "../types/domain.js";

interface CreateMessageInput {
  role: UserRole;
  sessionId: string;
  senderName: string;
  message: string;
}

export class ChatService {
  private readonly fallbackBuffer: ChatMessageView[] = [];

  public async createMessage(input: CreateMessageInput): Promise<ChatMessageView> {
    const normalized = {
      ...input,
      senderName: input.senderName.trim(),
      message: input.message.trim()
    };

    if (!normalized.message) {
      throw new Error("Message cannot be empty");
    }

    if (!isDatabaseConnected()) {
      const fallbackMessage = {
        id: `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: normalized.role,
        senderName: normalized.senderName,
        message: normalized.message,
        createdAt: new Date().toISOString()
      } satisfies ChatMessageView;

      this.fallbackBuffer.push(fallbackMessage);
      this.trimFallbackBuffer();
      return fallbackMessage;
    }

    const message = await ChatMessageModel.create(normalized);
    return {
      id: message.id,
      role: message.role,
      senderName: message.senderName,
      message: message.message,
      createdAt: message.createdAt.toISOString()
    };
  }

  public async getRecentMessages(limit = 30): Promise<ChatMessageView[]> {
    if (!isDatabaseConnected()) {
      return [...this.fallbackBuffer].slice(-limit);
    }

    const messages = await ChatMessageModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages
      .reverse()
      .map((message) => ({
        id: message._id.toString(),
        role: message.role,
        senderName: message.senderName,
        message: message.message,
        createdAt: message.createdAt.toISOString()
      }));
  }

  private trimFallbackBuffer(): void {
    const max = 100;
    if (this.fallbackBuffer.length <= max) {
      return;
    }

    this.fallbackBuffer.splice(0, this.fallbackBuffer.length - max);
  }
}
