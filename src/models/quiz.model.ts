import mongoose, { Document, Schema, Types } from "mongoose";

export interface IQuizQuestion {
  questionNumber: number;
  questionText: string;
  options: {
    key: "A" | "B" | "C" | "D";
    text: string;
  }[];
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  hintTimestamp?: string;
  hintTitle?: string;
}

export interface IQuiz extends Document {
  module: Types.ObjectId;
  title: string;
  maxAttempts: number;
  passingScore: number;
  badgeRewardName: string;
  badgeRewardImage: string;
  /** False when the module's quiz has no published questions in the CMS */
  isActive: boolean;
  /** Hours until a fresh round of attempts once all are used; 0 = never */
  retryAfterHours: number;
  questions: IQuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const quizSchema = new Schema<IQuiz>(
  {
    module: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    passingScore: {
      type: Number,
      default: 5, // All 5 must be correct
    },
    badgeRewardName: {
      type: String,
      required: true,
    },
    badgeRewardImage: {
      type: String,
      default: "/Badge_earned.png",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    retryAfterHours: {
      type: Number,
      default: 24,
    },
    questions: [
      {
        questionNumber: { type: Number, required: true },
        questionText: { type: String, required: true },
        options: [
          {
            key: { type: String, enum: ["A", "B", "C", "D"], required: true },
            text: { type: String, required: true },
          },
        ],
        correctOption: { type: String, enum: ["A", "B", "C", "D"], required: true },
        explanation: { type: String, default: "" },
        hintTimestamp: { type: String },
        hintTitle: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Quiz = mongoose.model<IQuiz>("Quiz", quizSchema);
