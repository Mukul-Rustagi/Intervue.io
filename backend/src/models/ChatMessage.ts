import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const ChatMessageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["teacher", "student"],
      required: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  {
    timestamps: true
  }
);

ChatMessageSchema.index({ createdAt: -1 });

export type ChatMessageDocument = HydratedDocument<InferSchemaType<typeof ChatMessageSchema>>;

export const ChatMessageModel = model("ChatMessage", ChatMessageSchema);
