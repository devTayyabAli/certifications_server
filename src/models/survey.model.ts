import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISurveyAnswer {
  /** CMS row id of the question — stable even if its wording is edited */
  questionId?: string;
  questionIndex: number;
  /** The question exactly as the learner saw it, kept for the research report */
  questionText: string;
  answerText: string;
}

export interface ISocialFollow {
  /** CMS row id of the social account */
  socialId: string;
  platform: string;
  url: string;
  followedAt: Date;
}

export interface ISurvey extends Document {
  user: Types.ObjectId;
  surveyType: "part1" | "part2";
  /**
   * "draft" while the learner is still working through it (Save & exit),
   * "completed" once submitted. Older records have no status and were always
   * submitted in one go — treat them as completed.
   */
  status?: "draft" | "completed";
  answers: ISurveyAnswer[];
  socialFollows: ISocialFollow[];
  videoWatchedAt?: Date;
  /** @deprecated Older submissions recorded follows as fixed booleans */
  followedSocials?: {
    x: boolean;
    linkedin: boolean;
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const surveySchema = new Schema<ISurvey>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    surveyType: {
      type: String,
      enum: ["part1", "part2"],
      required: true,
    },
    // No default on purpose: a missing status marks a legacy, completed record
    status: {
      type: String,
      enum: ["draft", "completed"],
    },
    answers: [
      {
        _id: false,
        questionId: { type: String },
        questionIndex: { type: Number, required: true },
        questionText: { type: String, required: true },
        answerText: { type: String, default: "" },
      },
    ],
    socialFollows: [
      {
        _id: false,
        socialId: { type: String, required: true },
        platform: { type: String, default: "" },
        url: { type: String, default: "" },
        followedAt: { type: Date, default: Date.now },
      },
    ],
    videoWatchedAt: {
      type: Date,
    },
    followedSocials: {
      x: { type: Boolean },
      linkedin: { type: Boolean },
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// One survey submission per type per user
surveySchema.index({ user: 1, surveyType: 1 }, { unique: true });

export function isSurveyCompleted(survey: Pick<ISurvey, "status" | "completedAt"> | null | undefined) {
  if (!survey) return false;
  if (survey.status) return survey.status === "completed";
  return !!survey.completedAt;
}

export const Survey = mongoose.model<ISurvey>("Survey", surveySchema);
