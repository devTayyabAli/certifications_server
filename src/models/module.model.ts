import mongoose, { Document, Schema } from "mongoose";

export interface IChapter {
  time: string;
  title: string;
}

export interface ISpeaker {
  name: string;
  role: string;
  companyTag: string;
  companyName: string;
  headshotUrl?: string;
  companyLogoUrl?: string;
  bio?: string;
  telegramHandle?: string;
  sessionTitle?: string;
  sessionDate?: string;
  links: {
    website?: string;
    x?: string;
    linkedin?: string;
  };
}

export interface IModule extends Document {
  /** "cms" when managed from the SI3 CMS modules form; "seed" for local demo data */
  source?: "seed" | "cms";
  /** CMS row id — stable even when the title or slug is edited */
  cmsRowId?: string;
  /** Fingerprint of the CMS row, to skip writes when nothing changed */
  cmsHash?: string;
  partnerName?: string;
  /** Names to match in the SI<3> Speakers table; empty = match by session title */
  speakerNames?: string[];
  badgeName?: string;
  badgeImageUrl?: string;
  /** Earlier slugs — old links (calendar events, bookmarks) keep working */
  slugHistory?: string[];
  slug: string;
  title: string;
  week: number;
  dateLabel: string;
  tag: string;
  presenter: string;
  companyTag: string;
  description: string;
  aboutText: string[];
  thumbnailUrl?: string;
  bannerUrl?: string;
  videoUrl?: string;
  videoDurationSeconds: number;
  chapters: IChapter[];
  speakers: ISpeaker[];
  isPrerequisiteForCertificate: boolean;
  order: number;
  isPublished: boolean;
  scheduledDate?: Date;
  endDate?: Date;
  timezone?: string;
  location?: string;
  meetingLink?: string;
  sessionStatus?: "completed" | "active" | "upcoming";
  calendarTitle?: string;
  calendarDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema<IModule>(
  {
    source: { type: String, enum: ["seed", "cms"], default: "seed" },
    cmsRowId: { type: String, index: true, sparse: true },
    cmsHash: { type: String },
    partnerName: { type: String, default: "" },
    speakerNames: { type: [String], default: [] },
    badgeName: { type: String },
    badgeImageUrl: { type: String },
    slugHistory: { type: [String], default: [], index: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    week: {
      type: Number,
      required: true,
      index: true,
    },
    dateLabel: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      default: "MODULE",
    },
    presenter: {
      type: String,
      required: true,
    },
    companyTag: {
      type: String,
      default: "SI HER DEFI",
    },
    description: {
      type: String,
      required: true,
    },
    aboutText: {
      type: [String],
      default: [],
    },
    thumbnailUrl: {
      type: String,
    },
    bannerUrl: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    videoDurationSeconds: {
      type: Number,
      default: 0,
    },
    chapters: [
      {
        time: { type: String, required: true },
        title: { type: String, required: true },
      },
    ],
    speakers: [
      {
        name: { type: String, required: true },
        role: { type: String, required: true },
        companyTag: { type: String, default: "" },
        companyName: { type: String, default: "" },
        headshotUrl: { type: String },
        companyLogoUrl: { type: String },
        bio: { type: String },
        telegramHandle: { type: String },
        sessionTitle: { type: String },
        sessionDate: { type: String },
        links: {
          website: { type: String },
          x: { type: String },
          linkedin: { type: String },
        },
      },
    ],
    isPrerequisiteForCertificate: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    scheduledDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    location: {
      type: String,
      default: "Si Her DeFi Virtual Stage",
    },
    meetingLink: {
      type: String,
    },
    sessionStatus: {
      type: String,
      enum: ["completed", "active", "upcoming"],
      default: "upcoming",
    },
    calendarTitle: {
      type: String,
    },
    calendarDescription: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Module = mongoose.model<IModule>("Module", moduleSchema);
