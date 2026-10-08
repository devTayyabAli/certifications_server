import { Request, Response } from "express";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { ProfileService } from "./profile.service";

export class ProfileController {
  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const profile = await ProfileService.getProfile(userId);
    return ApiResponse.success(res, {
      message: "Profile retrieved successfully",
      data: profile,
    });
  });

  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const profile = await ProfileService.updateProfile(userId, req.body);
    return ApiResponse.success(res, {
      message: "Profile updated successfully",
      data: profile,
    });
  });

  static getPrefill = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const prefill = await ProfileService.getPrefill(userId);
    return ApiResponse.success(res, {
      message: "Application prefill data retrieved",
      data: prefill,
    });
  });
}
