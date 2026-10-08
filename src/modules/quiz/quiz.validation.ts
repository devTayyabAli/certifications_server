import { z } from "zod";

/** One answer at a time — it is locked and graded as soon as it arrives. */
export const answerQuestionSchema = z.object({
  questionNumber: z.number().int().min(1).max(100),
  selectedOption: z.enum(["A", "B", "C", "D"]),
});

export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;
