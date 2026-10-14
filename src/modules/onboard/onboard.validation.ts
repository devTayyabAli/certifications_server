import { z } from "zod";

// Hard upper bounds only — per-question limits come from the CMS and are
// enforced in the service.
const answerSchema = z.object({
  questionId: z.string().trim().min(1).max(100),
  answerText: z.string().max(5000).default(""),
});

const answersSchema = z.array(answerSchema).max(50);
const followedSocialIdsSchema = z.array(z.string().trim().min(1).max(100)).max(20);

/** Partial progress saved from "Save & exit", a follow click or the video ending. */
export const part1DraftSchema = z.object({
  answers: answersSchema.optional(),
  followedSocialIds: followedSocialIdsSchema.optional(),
  videoWatched: z.boolean().optional(),
});

/** Final submission — checked against the questions published in the CMS. */
export const part1SubmitSchema = z.object({
  answers: answersSchema.default([]),
  followedSocialIds: followedSocialIdsSchema.default([]),
  videoWatched: z.boolean().optional(),
});

/** Part 2 answers keyed by question id ("part2-q-1"…). No per-answer character limit, just a sane cap. */
export const part2SurveySchema = z.object({
  answers: z.record(z.string().max(64), z.string().max(10000)),
});

export type Part1DraftInput = z.infer<typeof part1DraftSchema>;
export type Part1SubmitInput = z.infer<typeof part1SubmitSchema>;
export type Part2SurveyInput = z.infer<typeof part2SurveySchema>;
