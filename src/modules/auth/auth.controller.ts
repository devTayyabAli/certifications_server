import { Request, Response } from "express";
import { Profile } from "../../models/profile.model";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { AuthService } from "./auth.service";

export class AuthController {
  static claimSeat = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await AuthService.claimSeat(email);
    return ApiResponse.success(res, {
      message: "Verification code sent to your email address",
      data: result,
    });
  });

  static verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { email, code } = req.body;
    const result = await AuthService.verifyOtp(email, code);
    return ApiResponse.success(res, {
      message: "Email verified successfully",
      data: result,
    });
  });

  static resendOtp = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await AuthService.resendOtp(email);
    return ApiResponse.success(res, {
      message: "A fresh verification code has been dispatched",
      data: result,
    });
  });

  static getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const profile = await Profile.findOne({ user: user._id });

    return ApiResponse.success(res, {
      message: "User session retrieved",
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
          isEmailVerified: user.isEmailVerified,
        },
        profile: profile
          ? {
              name: profile.name,
              role: profile.role,
              organization: profile.organization,
              socialLink: profile.socialLink,
              bio: profile.bio,
              photoUrl: profile.photoUrl,
              prefilledFields: profile.prefilledFields,
            }
          : null,
      },
    });
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    // Revokes this token and every other one issued to the learner
    await AuthService.logout(req.user!);
    return ApiResponse.success(res, {
      message: "Logged out successfully",
    });
  });
}
