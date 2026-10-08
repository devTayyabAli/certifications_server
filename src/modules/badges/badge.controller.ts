import { Request, Response } from "express";
import { COHORT_BADGE_TOTAL, LEGACY_ORIENTATION_BADGE_ID } from "../../constants/cohort";
import { UserProgress } from "../../models/progress.model";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";

export class BadgeController {
  static getBadges = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const progress = await UserProgress.findOne({ user: userId });

    // Badges come only from passed module quizzes; onboarding awards none.
    const badges = (progress?.earnedBadges ?? []).filter(
      (b) => b.badgeId !== LEGACY_ORIENTATION_BADGE_ID
    );

    return ApiResponse.success(res, {
      message: "Badges retrieved successfully",
      data: {
        totalCohortBadges: COHORT_BADGE_TOTAL,
        earnedCount: badges.length,
        badges,
      },
    });
  });
}
