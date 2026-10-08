import { Request, Response } from "express";
import { CALENDAR_LABELS, toCalendarType } from "../../constants/calendar";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { ModuleService } from "./module.service";

export class ModuleController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const modules = await ModuleService.getAllModules(userId);
    return ApiResponse.success(res, {
      message: "Modules retrieved successfully",
      data: modules,
    });
  });

  static getCmsSpeakers = asyncHandler(async (_req: Request, res: Response) => {
    const speakers = await ModuleService.getCmsSpeakers();
    return ApiResponse.success(res, {
      message: "CMS cohort speakers retrieved",
      data: speakers,
    });
  });

  static getOne = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { id } = req.params;
    const moduleData = await ModuleService.getModuleBySlugOrId(id, userId);
    return ApiResponse.success(res, {
      message: "Module details retrieved",
      data: moduleData,
    });
  });

  static schedule = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { id } = req.params;
    const calendarType = toCalendarType(req.body?.calendarType);
    const result = await ModuleService.scheduleModuleSession(id, userId, calendarType);
    return ApiResponse.success(res, {
      message: `Session added to ${CALENDAR_LABELS[calendarType]}`,
      data: result,
    });
  });

  static unschedule = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { id } = req.params;
    const result = await ModuleService.unscheduleModuleSession(id, userId);
    return ApiResponse.success(res, {
      message: "Session schedule removed",
      data: result,
    });
  });

  static getCalendarLinks = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await ModuleService.getModuleCalendarLinks(id);
    return ApiResponse.success(res, {
      message: "Calendar links retrieved",
      data: result,
    });
  });

  static downloadIcs = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { filename, icsContent } = await ModuleService.getModuleIcs(id);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(icsContent);
  });
}

