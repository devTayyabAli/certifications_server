import { Types } from "mongoose";
import { IModule } from "../../models/module.model";
import { IQuizAttempt, IUserProgress, UserProgress } from "../../models/progress.model";
import { IQuiz, IQuizQuestion, Quiz } from "../../models/quiz.model";
import { isQuizOpen, sessionState } from "../../services/module-catalog.service";
import { ApiError } from "../../utils/api-error";
import { ModuleService, findPublishedModule } from "../modules/module.service";
import { OnboardService } from "../onboard/onboard.service";
import { AnswerQuestionInput } from "./quiz.validation";

/**
 * Module quizzes are graded on the server, one question at a time:
 *
 *  - the first answer starts an attempt (up to the quiz's max attempts);
 *  - every answer is locked as soon as it is given;
 *  - a correct answer returns its explanation, a wrong one only a hint to
 *    the part of the recording to rewatch — never the right option;
 *  - answering the last question finishes the attempt. Passing awards the
 *    module badge, completes the module and, for the certificate module,
 *    unlocks the certificate.
 */

function isCompletedAttempt(a: IQuizAttempt) {
  return a.status !== "in_progress";
}

function attemptsFor(progress: IUserProgress | null, quiz: IQuiz) {
  return (progress?.quizAttempts ?? []).filter((a) => a.quiz.toString() === quiz._id.toString());
}

/**
 * Attempts come in rounds of `maxAttempts`. When a round is used up without a
 * pass, the quiz rests for `retryAfterHours` (time to rewatch), then a fresh
 * round opens. `retryAfterHours = 0` keeps it closed for good.
 */
export function roundState(attempts: IQuizAttempt[], quiz: IQuiz, now = new Date()) {
  const max = Math.max(quiz.maxAttempts, 1);
  const total = attempts.length;
  if (total === 0) return { usedInRound: 0, remaining: max, retryAvailableAt: null as Date | null };

  const usedInRound = ((total - 1) % max) + 1;
  const hasOpenAttempt = attempts.some((a) => !isCompletedAttempt(a));
  if (usedInRound < max || hasOpenAttempt) {
    return { usedInRound, remaining: max - usedInRound, retryAvailableAt: null as Date | null };
  }

  // The round is used up
  const retryHours = quiz.retryAfterHours ?? 24;
  if (!retryHours) return { usedInRound: max, remaining: 0, retryAvailableAt: null as Date | null };
  const last = attempts[total - 1];
  const retryAt = new Date((last.completedAt ?? last.attemptedAt).getTime() + retryHours * 60 * 60 * 1000);
  return now >= retryAt
    ? { usedInRound: 0, remaining: max, retryAvailableAt: null as Date | null }
    : { usedInRound: max, remaining: 0, retryAvailableAt: retryAt };
}

function hintFor(q: IQuizQuestion | undefined) {
  return q?.hintTimestamp ? { timestamp: q.hintTimestamp, title: q.hintTitle || "" } : null;
}

/** What the learner sees for each answer they've locked in. */
function answerFeedback(quiz: IQuiz, answer: IQuizAttempt["answers"][number]) {
  const q = quiz.questions.find((x) => x.questionNumber === answer.questionNumber);
  return {
    questionNumber: answer.questionNumber,
    selectedOption: answer.selectedOption,
    isCorrect: answer.isCorrect,
    explanation: answer.isCorrect ? q?.explanation || null : null,
    hint: answer.isCorrect ? null : hintFor(q),
  };
}

function attemptResult(
  quiz: IQuiz,
  attempt: IQuizAttempt,
  round: { remaining: number; retryAvailableAt: Date | null }
) {
  return {
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
    totalQuestions: quiz.questions.length,
    passingScore: quiz.passingScore,
    passed: attempt.passed,
    attemptsRemaining: round.remaining,
    /** When a fresh round of attempts opens, if this one is used up */
    retryAvailableAt: round.retryAvailableAt,
    // What to rewatch before trying again
    review: attempt.answers
      .filter((a) => !a.isCorrect)
      .map((a) => {
        const q = quiz.questions.find((x) => x.questionNumber === a.questionNumber);
        return { questionNumber: a.questionNumber, questionText: q?.questionText ?? "", hint: hintFor(q) };
      }),
  };
}

async function loadQuiz(moduleDoc: IModule) {
  const quiz = await Quiz.findOne({ module: moduleDoc._id });
  if (!quiz || !quiz.isActive || quiz.questions.length === 0) {
    throw ApiError.notFound("This module's quiz isn't published yet.");
  }
  return quiz;
}

export class QuizService {
  static async getQuizByModule(moduleSlugOrId: string, userId: Types.ObjectId) {
    const moduleDoc = await findPublishedModule(moduleSlugOrId);
    const quiz = await loadQuiz(moduleDoc);
    const progress = await UserProgress.findOne({ user: userId });

    const attempts = attemptsFor(progress, quiz);
    const completed = attempts.filter(isCompletedAttempt);
    const open = attempts.find((a) => !isCompletedAttempt(a)) ?? null;
    const passedAttempt = completed.find((a) => a.passed) ?? null;
    const lastCompleted = completed[completed.length - 1] ?? null;
    const round = roundState(attempts, quiz);
    const state = sessionState(moduleDoc);

    return {
      quizId: quiz._id,
      moduleSlug: moduleDoc.slug,
      title: quiz.title,
      isOpen: isQuizOpen(state),
      sessionState: state,
      maxAttempts: quiz.maxAttempts,
      passingScore: quiz.passingScore,
      totalQuestions: quiz.questions.length,
      // Counted within the current round of attempts
      attemptsUsed: round.usedInRound,
      attemptsRemaining: round.remaining,
      retryAvailableAt: round.retryAvailableAt,
      retryAfterHours: quiz.retryAfterHours ?? 24,
      isPassed: !!passedAttempt,
      badge: { name: quiz.badgeRewardName, image: quiz.badgeRewardImage },
      // Questions and options only — the correct option never leaves the server
      questions: quiz.questions.map((q) => ({
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        options: q.options.map((o) => ({ key: o.key, text: o.text })),
      })),
      currentAttempt: open
        ? { attemptNumber: round.usedInRound, answers: open.answers.map((a) => answerFeedback(quiz, a)) }
        : null,
      lastResult: lastCompleted ? attemptResult(quiz, passedAttempt ?? lastCompleted, round) : null,
    };
  }

  static async answerQuestion(moduleSlugOrId: string, userId: Types.ObjectId, input: AnswerQuestionInput) {
    await OnboardService.assertPart1Complete(userId);

    const moduleDoc = await findPublishedModule(moduleSlugOrId);
    const quiz = await loadQuiz(moduleDoc);
    if (!isQuizOpen(sessionState(moduleDoc))) {
      throw ApiError.forbidden("This quiz opens after the live session.");
    }

    const question = quiz.questions.find((q) => q.questionNumber === input.questionNumber);
    if (!question) throw ApiError.badRequest("That question isn't part of this quiz.");
    if (!question.options.some((o) => o.key === input.selectedOption)) {
      throw ApiError.badRequest("That option isn't available for this question.");
    }

    const progress =
      (await UserProgress.findOne({ user: userId })) ??
      new UserProgress({ user: userId, completedModules: [], earnedBadges: [], quizAttempts: [] });

    const attempts = attemptsFor(progress, quiz);
    if (attempts.some((a) => a.passed)) {
      throw ApiError.conflict("You've already passed this quiz.");
    }

    let attempt = attempts.find((a) => !isCompletedAttempt(a));
    if (!attempt) {
      const round = roundState(attempts, quiz);
      if (round.remaining === 0) {
        throw ApiError.badRequest(
          round.retryAvailableAt
            ? `You've used all ${quiz.maxAttempts} attempts for now. Rewatch the session — you can try again after ${round.retryAvailableAt.toUTCString()}.`
            : `You've used all ${quiz.maxAttempts} attempts for this quiz. Please reach out to the Si Her team.`
        );
      }
      progress.quizAttempts.push({
        quiz: quiz._id as Types.ObjectId,
        attemptNumber: attempts.length + 1,
        status: "in_progress",
        score: 0,
        passed: false,
        answers: [],
        attemptedAt: new Date(),
      });
      attempt = progress.quizAttempts[progress.quizAttempts.length - 1];
    }

    if (attempt.answers.some((a) => a.questionNumber === input.questionNumber)) {
      throw ApiError.conflict("You've already answered this question in this attempt.");
    }

    const isCorrect = question.correctOption === input.selectedOption;
    attempt.answers.push({
      questionNumber: input.questionNumber,
      selectedOption: input.selectedOption,
      isCorrect,
    });
    attempt.score = attempt.answers.filter((a) => a.isCorrect).length;

    // Finished once every question currently in the quiz has an answer
    const answered = new Set(attempt.answers.map((a) => a.questionNumber));
    const isFinished = quiz.questions.every((q) => answered.has(q.questionNumber));

    let badgeEarned: { name: string; image: string } | null = null;
    let certificateUnlocked = false;

    if (isFinished) {
      attempt.status = "completed";
      attempt.completedAt = new Date();
      attempt.passed = attempt.score >= quiz.passingScore;

      if (attempt.passed) {
        const badgeId = `badge_${moduleDoc.slug}`;
        if (!progress.earnedBadges.some((b) => b.badgeId === badgeId)) {
          progress.earnedBadges.push({
            badgeId,
            name: quiz.badgeRewardName,
            image: quiz.badgeRewardImage,
            earnedAt: new Date(),
            sourceModuleId: moduleDoc._id as Types.ObjectId,
          });
        }
        badgeEarned = { name: quiz.badgeRewardName, image: quiz.badgeRewardImage };
        certificateUnlocked = await ModuleService.recordCompletion(progress, moduleDoc, userId);
      }
    }

    // One save for the answer, the attempt, the badge and the completion
    await progress.save();

    const round = roundState(attemptsFor(progress, quiz), quiz);

    return {
      ...answerFeedback(quiz, attempt.answers[attempt.answers.length - 1]),
      // Shown as "Attempt x of N" within the current round
      attemptNumber: isFinished && round.usedInRound === 0 ? quiz.maxAttempts : round.usedInRound,
      answeredCount: attempt.answers.length,
      totalQuestions: quiz.questions.length,
      result: isFinished
        ? {
            ...attemptResult(quiz, attempt, round),
            badgeEarned,
            certificateUnlocked,
          }
        : null,
    };
  }
}
