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

  /** Starts the on-chain mint; the certificate comes back pending until the chain confirms it. */
  static mint = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificateService.mint(req.user!._id);
    return ApiResponse.success(res, {
      message: data.status === "minted" ? "Certificate minted" : "Minting your certificate",
      data,
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
