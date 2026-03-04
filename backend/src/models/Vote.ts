import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from "mongoose";

const VoteSchema = new Schema(
  {
    pollId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Poll",
      index: true
    },
    optionId: {
      type: String,
      required: true,
      index: true
    },
    studentSessionId: {
      type: String,
      required: true,
      index: true
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    }
  },
  {
    timestamps: true
  }
);

VoteSchema.index({ pollId: 1, studentSessionId: 1 }, { unique: true });

export type VoteDocument = HydratedDocument<InferSchemaType<typeof VoteSchema>>;

export const VoteModel = model("Vote", VoteSchema);
