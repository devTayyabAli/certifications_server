import { Types } from "mongoose";
import { HttpStatus } from "../../constants/http-status";
import { ISocialFollow, ISurvey, Survey, isSurveyCompleted } from "../../models/survey.model";
import { CmsOnboardingService, OnboardingContent } from "../../services/cms-onboarding.service";
import { ApiError } from "../../utils/api-error";
import { Part1DraftInput, Part1SubmitInput, Part2SurveyInput } from "./onboard.validation";

type SurveyStatus = "not_started" | "draft" | "completed";

async function requirePart1Content(): Promise<OnboardingContent> {
  const content = await CmsOnboardingService.getPart("part1");
  if (!content) {
    throw new ApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      "Si Her Onboard isn't published yet. Please check back shortly."
    );
  }
  return content;
}

function surveyStatus(survey: ISurvey | null): SurveyStatus {
  if (!survey) return "not_started";
  return isSurveyCompleted(survey) ? "completed" : "draft";
}

/** questionId → answer text, from whatever the learner has saved so far. */
function savedAnswers(survey: ISurvey | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const answer of survey?.answers ?? []) {
    if (answer.questionId) map[answer.questionId] = answer.answerText ?? "";
  }
  return map;
}

function learnerProgress(survey: ISurvey | null) {
  return {
    status: surveyStatus(survey),
    videoWatched: !!survey?.videoWatchedAt,
    followedSocialIds: (survey?.socialFollows ?? []).map((f) => f.socialId),
    answers: savedAnswers(survey),
    completedAt: isSurveyCompleted(survey) ? survey?.completedAt ?? null : null,
  };
}

/**
 * Merges newly submitted answers and follows into what is already saved,
 * keeping only questions / socials that are currently published in the CMS.
 */
function mergeProgress(
  content: OnboardingContent,
  survey: ISurvey | null,
  input: { answers?: { questionId: string; answerText: string }[]; followedSocialIds?: string[] }
) {
  const answers = savedAnswers(survey);
  const questionIds = new Set(content.questions.map((q) => q.id));
  for (const { questionId, answerText } of input.answers ?? []) {
    if (questionIds.has(questionId)) answers[questionId] = answerText;
  }

  const follows = new Map<string, ISocialFollow>(
    (survey?.socialFollows ?? []).map((f) => [f.socialId, f])
  );
  for (const socialId of input.followedSocialIds ?? []) {
    const social = content.socials.find((s) => s.id === socialId);
    if (social && !follows.has(socialId)) {
      follows.set(socialId, {
        socialId,
        platform: social.platform,
        url: social.url,
        followedAt: new Date(),
      });
    }
  }

  return { answers, follows: [...follows.values()] };
}

/** Answer rows in question order, with the question text snapshotted. */
function answerRecords(content: OnboardingContent, answers: Record<string, string>) {
  return content.questions
    .map((q, index) => ({
      questionId: q.id,
      questionIndex: index + 1,
      questionText: q.question,
      answerText: (answers[q.id] ?? "").trim(),
    }))
    .filter((a) => a.answerText !== "");
}

function lengthErrors(content: OnboardingContent, answers: Record<string, string>) {
  return content.questions
    .filter((q) => (answers[q.id] ?? "").trim().length > q.maxLength)
    .map((q) => ({
      field: q.id,
      message: `Please keep this answer under ${q.maxLength} characters.`,
    }));
}

export class OnboardService {
  static async getStatus(userId: Types.ObjectId) {
    const [part1, part2, content] = await Promise.all([
      Survey.findOne({ user: userId, surveyType: "part1" }),
      Survey.findOne({ user: userId, surveyType: "part2" }),
      CmsOnboardingService.getPart("part1"),
    ]);

    return {
      part1Done: isSurveyCompleted(part1),
      part1Status: surveyStatus(part1),
      part1CompletedAt: isSurveyCompleted(part1) ? part1?.completedAt ?? null : null,
      part2Done: isSurveyCompleted(part2),
      part2CompletedAt: isSurveyCompleted(part2) ? part2?.completedAt ?? null : null,
      part2Unlocked: false, // Cohort Part 2 unlocks at the end of the cohort
      // What the dashboard "Start here" card shows — straight from the CMS
      part1Card: content
        ? {
            stepLabel: content.stepLabel,
            title: content.card.title,
            description: content.card.description,
            imageUrl: content.card.imageUrl,
            doneMessage: content.card.doneMessage,
            questionCount: content.questions.length,
            questionsMinutes: content.questionsMinutes,
            videoMinutes: content.video.minutes,
          }
        : null,
    };
  }

  /** Published Part 1 content plus everything this learner has saved so far. */
  static async getPart1(userId: Types.ObjectId) {
    const [content, survey] = await Promise.all([
      requirePart1Content(),
      Survey.findOne({ user: userId, surveyType: "part1" }),
    ]);

    return { content, progress: learnerProgress(survey) };
  }

  static async saveDraft(userId: Types.ObjectId, input: Part1DraftInput) {
    const content = await requirePart1Content();
    const survey = await Survey.findOne({ user: userId, surveyType: "part1" });

    if (isSurveyCompleted(survey)) {
      throw ApiError.conflict("You've already submitted Si Her Onboard – Part 1.");
    }

    const { answers, follows } = mergeProgress(content, survey, input);
    const errors = lengthErrors(content, answers);
    if (errors.length > 0) throw ApiError.badRequest("Some answers are too long.", errors);

    const updated = await Survey.findOneAndUpdate(
      { user: userId, surveyType: "part1" },
      {
        $set: {
          status: "draft",
          answers: answerRecords(content, answers),
          socialFollows: follows,
          ...(input.videoWatched && !survey?.videoWatchedAt ? { videoWatchedAt: new Date() } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return learnerProgress(updated);
  }

  /**
   * Final Part 1 submission. Checked against what is published in the CMS:
   * every required account followed, every required question answered, and
   * no answer over its limit. Onboarding awards no badge.
   */
  static async submitPart1(userId: Types.ObjectId, input: Part1SubmitInput) {
    const content = await requirePart1Content();
    const survey = await Survey.findOne({ user: userId, surveyType: "part1" });

    if (isSurveyCompleted(survey)) {
      throw ApiError.conflict("You've already submitted Si Her Onboard – Part 1.");
    }

    const { answers, follows } = mergeProgress(content, survey, input);
    const followedIds = new Set(follows.map((f) => f.socialId));

    // Belt and braces: an onboarding with no questions can't be submitted
    if (content.questions.length === 0) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "Si Her Onboard isn't published yet. Please check back shortly."
      );
    }

    const errors = [
      ...content.socials
        .filter((s) => s.required && !followedIds.has(s.id))
        .map((s) => ({ field: s.id, message: `Please follow ${s.label} first.` })),
      ...content.questions
        .filter((q) => q.required && !(answers[q.id] ?? "").trim())
        .map((q) => ({ field: q.id, message: "This question needs an answer." })),
      ...lengthErrors(content, answers),
    ];
    if (errors.length > 0) {
      throw ApiError.badRequest("Please finish every required step before submitting.", errors);
    }

    const completedAt = new Date();
    const updated = await Survey.findOneAndUpdate(
      { user: userId, surveyType: "part1" },
      {
        $set: {
          status: "completed",
          answers: answerRecords(content, answers),
          socialFollows: follows,
          completedAt,
          ...(input.videoWatched && !survey?.videoWatchedAt ? { videoWatchedAt: completedAt } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
      success: true,
      surveyId: updated._id,
      completedAt,
    };
  }

  static async submitPart2(userId: Types.ObjectId, data: Part2SurveyInput) {
    const survey = await Survey.findOneAndUpdate(
      { user: userId, surveyType: "part2" },
      {
        user: userId,
        surveyType: "part2",
        status: "completed",
        answers: data.answers,
        completedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      surveyId: survey._id,
      completedAt: survey.completedAt,
    };
  }

  static async isPart1Complete(userId: Types.ObjectId) {
    return isSurveyCompleted(await Survey.findOne({ user: userId, surveyType: "part1" }));
  }

  /** Modules (sessions, quizzes, completion) open only after Part 1. */
  static async assertPart1Complete(userId: Types.ObjectId) {
    if (!(await this.isPart1Complete(userId))) {
      throw ApiError.forbidden("Finish Si Her Onboard – Part 1 to unlock the modules.");
    }
  }
}
