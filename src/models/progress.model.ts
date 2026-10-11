import mongoose, { Document, Schema, Types } from "mongoose";

export interface IQuizAttempt {
  quiz: Types.ObjectId;
  attemptNumber: number;
  /**
   * "in_progress" while the learner answers question by question (each
   * answer is locked as it is given); "completed" once every question is
   * answered. Older attempts have no status and were always completed.
   */
  status?: "in_progress" | "completed";
  score: number;
  passed: boolean;
  answers: {
    questionNumber: number;
    selectedOption: "A" | "B" | "C" | "D";
    isCorrect: boolean;
  }[];
  attemptedAt: Date;
  completedAt?: Date;
  /**
   * Set when the learner started over after using every attempt: the
   * attempt stays on record but no longer counts toward the current set.
   */
  archived?: boolean;
}

/** A quiz the learner skipped after using every attempt: no badge, but the module counts as done. */
export interface ISkippedQuiz {
  quiz: Types.ObjectId;
  module: Types.ObjectId;
  skippedAt: Date;
}

export interface IEarnedBadge {
  badgeId: string;
  name: string;
  image: string;
  earnedAt: Date;
  sourceModuleId?: Types.ObjectId;
}

export interface IUserProgress extends Document {
  user: Types.ObjectId;
  completedModules: Types.ObjectId[];
  earnedBadges: IEarnedBadge[];
  quizAttempts: IQuizAttempt[];
  skippedQuizzes: ISkippedQuiz[];
  hasPassedPrerequisiteForCertificate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userProgressSchema = new Schema<IUserProgress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    completedModules: [
      {
        type: Schema.Types.ObjectId,
        ref: "Module",
      },
    ],
    earnedBadges: [
      {
        badgeId: { type: String, required: true },
        name: { type: String, required: true },
        image: { type: String, default: "/Badge_earned.png" },
        earnedAt: { type: Date, default: Date.now },
        sourceModuleId: { type: Schema.Types.ObjectId, ref: "Module" },
      },
    ],
    quizAttempts: [
      {
        quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
        attemptNumber: { type: Number, required: true },
        status: { type: String, enum: ["in_progress", "completed"] },
        score: { type: Number, required: true },
        passed: { type: Boolean, required: true },
        answers: [
          {
            questionNumber: { type: Number },
            selectedOption: { type: String, enum: ["A", "B", "C", "D"] },
            isCorrect: { type: Boolean },
          },
        ],
        attemptedAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
        archived: { type: Boolean },
      },
    ],
    skippedQuizzes: [
      {
        quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
        module: { type: Schema.Types.ObjectId, ref: "Module", required: true },
        skippedAt: { type: Date, default: Date.now },
      },
    ],
    hasPassedPrerequisiteForCertificate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const UserProgress = mongoose.model<IUserProgress>("UserProgress", userProgressSchema);
