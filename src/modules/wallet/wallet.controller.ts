import { Request, Response } from "express";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { WalletService } from "./wallet.service";

export class WalletController {
  static getNonce = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const data = await WalletService.getNonce(userId);
    return ApiResponse.success(res, {
      message: "Signing nonce generated",
      data,
    });
  });

  static connect = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const data = await WalletService.connectWallet(userId, req.body);
    return ApiResponse.success(res, {
      message: "Wallet successfully connected and verified on Base Mainnet",
      data,
    });
  });

  static disconnect = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const data = await WalletService.disconnectWallet(userId);
    return ApiResponse.success(res, {
      message: "Wallet disconnected",
      data,
    });
  });

  static getStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const data = await WalletService.getWalletStatus(userId);
    return ApiResponse.success(res, {
      message: "Wallet connection status",
      data,
    });
  });
}
