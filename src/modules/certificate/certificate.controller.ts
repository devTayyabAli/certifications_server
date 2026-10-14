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

  /** A signed voucher for the learner's wallet to claim its earned badges on-chain. */
  static claimVoucher = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificateService.claimVoucher(req.user!._id);
    return ApiResponse.success(res, { message: "Claim voucher ready", data });
  });

  /** The claim transaction the wallet sent; the certificate comes back pending until the chain confirms it. */
  static recordClaim = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificateService.recordClaim(req.user!._id, req.body.txHash);
    return ApiResponse.success(res, {
      message: data.status === "minted" ? "Certificate minted" : "Claim submitted",
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
