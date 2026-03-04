import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";

const PollOptionSchema = new Schema(
  {
    optionId: {
      type: String,
      required: true,
      default: () => new Types.ObjectId().toString()
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200
    },
    voteCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    _id: false
  }
);

const PollSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 280
    },
    options: {
      type: [PollOptionSchema],
      validate: {
        validator: (options: unknown[]) => options.length >= 2 && options.length <= 6,
        message: "Poll must contain 2 to 6 options"
      }
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 10,
      max: 60
    },
    startedAt: {
      type: Date,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      index: true
    },
    createdBySessionId: {
      type: String,
      required: true
    },
    endedAt: {
      type: Date,
      default: null
    },
    endReason: {
      type: String,
      enum: ["timer", "all_answered", "manual", null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

PollSchema.index({ status: 1, expiresAt: 1 });

export type PollDocument = HydratedDocument<InferSchemaType<typeof PollSchema>>;

export const PollModel = model("Poll", PollSchema);
