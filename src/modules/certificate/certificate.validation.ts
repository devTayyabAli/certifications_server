import { z } from "zod";

export const recordMintSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "Must be a valid Ethereum / Base transaction hash (0x...)"),
  tokenId: z.string().trim().min(1, "Token ID is required"),
  blockNumber: z.number().int().positive().optional(),
});

export type RecordMintInput = z.infer<typeof recordMintSchema>;
