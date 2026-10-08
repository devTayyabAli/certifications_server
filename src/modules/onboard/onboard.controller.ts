import { Request, Response } from "express";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { OnboardService } from "./onboard.service";

export class OnboardController {
  static getStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const status = await OnboardService.getStatus(userId);
    return ApiResponse.success(res, {
      message: "Onboarding progress status",
      data: status,
    });
  });

  static getPart1 = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const result = await OnboardService.getPart1(userId);
    return ApiResponse.success(res, {
      message: "Si Her Onboard - Part 1 content",
      data: result,
    });
  });

  static saveDraft = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const progress = await OnboardService.saveDraft(userId, req.body);
    return ApiResponse.success(res, {
      message: "Progress saved",
      data: progress,
    });
  });

  static submitPart1 = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const result = await OnboardService.submitPart1(userId, req.body);
    return ApiResponse.success(res, {
      message: "Si Her Onboard - Part 1 submitted successfully",
      data: result,
    });
  });

  static submitPart2 = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const result = await OnboardService.submitPart2(userId, req.body);
    return ApiResponse.success(res, {
      message: "Si Her Onboard - Part 2 submitted successfully",
      data: result,
    });
  });
}
