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
   * Send the 6-digit sign-in code with the "Si Her DeFi sign-in code"
   * transactional email in Loops (sender: Si Her DeFi · dao@si3.space).
   * The template takes exactly two data variables, both required:
   * `code` and `expiresInMinutes`.
   */
  static async sendOtpEmail(email: string, otpCode: string, expiresInMinutes: number): Promise<SendOtpResult> {
    const loops = this.getClient();

    if (!loops) {
      console.warn("⚠️ [LOOPS] LOOPS_API_KEY is not configured in .env. Skipping remote email dispatch.");
      return {
        success: false,
        error: "LOOPS_API_KEY is not configured in .env",
      };
    }

    // Only the Si Her DeFi template sends sign-in codes. There is deliberately no
    // event-based fallback: it could trigger an older loop (e.g. the Kaia login email).
    if (!env.LOOPS_TRANSACTIONAL_ID) {
      return { success: false, error: "LOOPS_TRANSACTIONAL_ID is not configured" };
    }

    try {
      const res = await loops.sendTransactionalEmail({
        transactionalId: env.LOOPS_TRANSACTIONAL_ID,
        email,
        dataVariables: {
          code: otpCode,
          expiresInMinutes,
        },
      });

      if (res.success) {
        return { success: true, message: "Transactional email sent" };
      }
      console.warn(`⚠️ [LOOPS] Transactional dispatch returned unsuccessful:`, res);
      return { success: false, error: "Loops returned unsuccessful response" };
    } catch (err: any) {
      console.error(`❌ [LOOPS] Error sending email to ${email}:`, err.message || err);
      return {
        success: false,
        error: err.message || "Failed to dispatch email via Loops",
      };
    }
  }
}
