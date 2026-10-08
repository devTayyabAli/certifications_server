import { Request, Response } from "express";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { SettingsService } from "./settings.service";

export class SettingsController {
  static getSettings = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const settings = await SettingsService.getSettings(userId);
    return ApiResponse.success(res, {
      message: "Account settings retrieved",
      data: settings,
    });
  });

  static updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const settings = await SettingsService.updateSettings(userId, req.body);
    return ApiResponse.success(res, {
      message: "Account settings updated",
      data: settings,
    });
  });
}
