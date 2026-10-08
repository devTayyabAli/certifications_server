import { z } from "zod";

export const connectWalletSchema = z.object({
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Please provide a valid Ethereum / Base wallet address (0x...)"),
  signature: z.string().optional(),
  chainId: z.union([z.string(), z.number()]).default("0x2105"), // Base Mainnet 8453 = 0x2105
});

export type ConnectWalletInput = z.infer<typeof connectWalletSchema>;
