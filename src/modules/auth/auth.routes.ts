import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { authRateLimiter, otpEmailRateLimiter } from "../../middlewares/rate-limiter.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { AuthController } from "./auth.controller";
import { claimSeatSchema, resendOtpSchema, verifyOtpSchema } from "./auth.validation";

const router = Router();

router.post(
  "/claim-seat",
  authRateLimiter,
  validateRequest({ body: claimSeatSchema }),
  otpEmailRateLimiter,
  AuthController.claimSeat
);

router.post(
  "/verify-otp",
  authRateLimiter,
  validateRequest({ body: verifyOtpSchema }),
  AuthController.verifyOtp
);

router.post(
  "/resend-otp",
  authRateLimiter,
  validateRequest({ body: resendOtpSchema }),
  otpEmailRateLimiter,
  AuthController.resendOtp
);

router.get("/me", authenticateJwt, AuthController.getMe);
router.post("/logout", authenticateJwt, AuthController.logout);

export const authRoutes = router;
