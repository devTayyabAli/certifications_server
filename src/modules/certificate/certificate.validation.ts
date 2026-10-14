import { z } from "zod";

/** The claim transaction the learner's wallet sent; checked on-chain before it counts. */
export const recordClaimSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid transaction hash (0x...)"),
});

export type RecordClaimInput = z.infer<typeof recordClaimSchema>;
