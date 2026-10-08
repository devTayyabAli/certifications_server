import { LoopsClient } from "loops";
import { env } from "../config/env";

export interface SendOtpResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class LoopsService {
  private static client: LoopsClient | null = null;

  /**
   * Lazily get or create Loops client if API key is provided
   */
  private static getClient(): LoopsClient | null {
    if (!env.LOOPS_API_KEY) {
      return null;
    }
    if (!this.client) {
      this.client = new LoopsClient(env.LOOPS_API_KEY);
    }
    return this.client;
  }

  /**
   * Send 6-digit OTP email using Loops.so.
   * Supports:
   * 1. Transactional Email Template (if LOOPS_TRANSACTIONAL_ID is set - Recommended)
   * 2. Event-triggered Email (if LOOPS_EVENT_NAME is configured)
   */
  static async sendOtpEmail(email: string, otpCode: string): Promise<SendOtpResult> {
    const loops = this.getClient();

    if (!loops) {
      console.warn("⚠️ [LOOPS] LOOPS_API_KEY is not configured in .env. Skipping remote email dispatch.");
      return {
        success: false,
        error: "LOOPS_API_KEY is not configured in .env",
      };
    }

    try {
      // 1. Preferred method: Transactional Email by ID
      if (env.LOOPS_TRANSACTIONAL_ID) {
        console.log(`📡 [LOOPS] Sending transactional OTP email to ${email} (Template: ${env.LOOPS_TRANSACTIONAL_ID})...`);
        const res = await loops.sendTransactionalEmail({
          transactionalId: env.LOOPS_TRANSACTIONAL_ID,
          email,
          dataVariables: {
            code: otpCode,
            otpCode: otpCode,
            otp: otpCode,
            expiresInMinutes: 10,
          },
        });

        if (res.success) {
          console.log(`✅ [LOOPS] Transactional OTP email successfully dispatched to ${email}!`);
          return { success: true, message: "Transactional email sent" };
        } else {
          console.warn(`⚠️ [LOOPS] Transactional dispatch returned unsuccessful:`, res);
          return { success: false, error: "Loops returned unsuccessful response" };
        }
      }

      // 2. Fallback method: Send Event
      const eventName = env.LOOPS_EVENT_NAME || "otp_verification";
      console.log(`📡 [LOOPS] Sending event "${eventName}" to ${email} with OTP...`);
      const eventRes = await loops.sendEvent({
        email,
        eventName,
        eventProperties: {
          code: otpCode,
          otpCode: otpCode,
          otp: otpCode,
          expiresInMinutes: 10,
        },
      });

      if (eventRes.success) {
        console.log(`✅ [LOOPS] Event "${eventName}" dispatched to ${email}!`);
        return { success: true, message: `Event ${eventName} dispatched` };
      } else {
        console.warn(`⚠️ [LOOPS] Event dispatch returned unsuccessful:`, eventRes);
        return { success: false, error: "Loops event dispatch unsuccessful" };
      }
    } catch (err: any) {
      console.error(`❌ [LOOPS] Error sending email to ${email}:`, err.message || err);
      return {
        success: false,
        error: err.message || "Failed to dispatch email via Loops",
      };
    }
  }
}
