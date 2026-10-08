import { z } from "zod";

export const claimSeatSchema = z.object({
  email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
  code: z.string().length(6, "Verification code must be exactly 6 digits").regex(/^\d+$/, "Code must contain only digits"),
});

export const resendOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
});

export type ClaimSeatInput = z.infer<typeof claimSeatSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
