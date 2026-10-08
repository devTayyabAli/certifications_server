import { Request, Response } from "express";
import { Partner } from "../../models/partner.model";
import { CmsDashboardService } from "../../services/cms-dashboard.service";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";

export class PartnerController {
  /** Partner cards: from the CMS (Si Her DeFi (Base) → Partners) once set up, else the database. */
  static getPartners = asyncHandler(async (_req: Request, res: Response) => {
    const fromCms = await CmsDashboardService.getPartners();
    const partners =
      fromCms ??
      (await Partner.find({ isActive: true }).sort({ order: 1 })).map((p) => ({
        id: String(p._id),
        order: p.order,
        title: p.title,
        tag: p.tag,
        description: p.description,
        imageUrl: null,
        actionText: p.actionText,
        actionUrl: /^(https?:\/\/|mailto:)/i.test(p.actionUrl) ? p.actionUrl : null,
        footerText: p.footerText,
      }));

    return ApiResponse.success(res, {
      message: "Partners retrieved successfully",
      data: partners,
    });
  });

  /** "More ways to build" banner (Si Her DeFi (Base) → More Ways); null hides it. */
  static getMoreWays = asyncHandler(async (_req: Request, res: Response) => {
    return ApiResponse.success(res, {
      message: "More ways content",
      data: await CmsDashboardService.getMoreWays(),
    });
  });
}
