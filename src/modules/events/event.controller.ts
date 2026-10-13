import { Request, Response } from "express";
import { CmsEventsService } from "../../services/cms-events.service";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";

export class EventController {
  static getEvents = asyncHandler(async (_req: Request, res: Response) => {
    const events = await CmsEventsService.getAllEvents();
    return ApiResponse.success(res, {
      message: "Cohort events retrieved",
      data: events,
    });
  });
}
