import { Request, Response } from "express";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { CertificateService } from "./certificate.service";

export class CertificateController {
  static getCertificate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cert = await CertificateService.getCertificate(userId);
    return ApiResponse.success(res, {
      message: "Certificate status retrieved",
      data: cert,
    });
  });

  static prepareMint = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const data = await CertificateService.prepareMint(userId);
    return ApiResponse.success(res, {
      message: "Minting payload prepared",
      data,
    });
  });

  static recordMint = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const result = await CertificateService.recordMint(userId, req.body);
    return ApiResponse.success(res, {
      message: "On-chain certificate minting recorded successfully",
      data: result,
    });
  });

  static verifyPublic = asyncHandler(async (req: Request, res: Response) => {
    const { identifier } = req.params;
    const result = await CertificateService.verifyCertificatePublic(identifier);
    return ApiResponse.success(res, {
      message: "Certificate verified on Base",
      data: result,
    });
  });
}
