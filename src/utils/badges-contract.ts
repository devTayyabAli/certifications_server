import { Contract, Interface, JsonRpcProvider, TransactionReceipt, Wallet, isAddress } from "ethers";
import { env } from "../config/env";

/**
 * The LearningBadges contract (soulbound ERC-1155): module badges 1–12 and
 * the capstone (13, the certificate). The server's minter wallet awards them,
 * so learners never sign or pay gas. Token id of a module badge = its week.
 */

export const CAPSTONE_TOKEN_ID = 13;
export const MAX_MODULE_TOKEN_ID = 12;

export const CHAINS = {
  base: { name: "Base", chainId: 8453, explorer: "https://basescan.org", rpc: "https://mainnet.base.org" },
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: 84532,
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org",
  },
  sepolia: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  },
} as const;

export function chain() {
  return CHAINS[env.CERTIFICATE_CHAIN];
}

const ABI = [
  "function batchAwardModuleBadges(address learner, uint256[] moduleIds)",
  "function awardCapstone(address learner)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function hasCapstoneBadge(address learner) view returns (bool)",
  "function paused() view returns (bool)",
  // custom errors, so a revert explains itself
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error EnforcedPause()",
  "error InvalidRecipient()",
  "error InvalidModule()",
  "error CapstoneAlreadyClaimed()",
  "error SoulboundToken()",
];

const REVERT_MESSAGES: Record<string, string> = {
  AccessControlUnauthorizedAccount: "The minting wallet doesn't have MINTER_ROLE on the contract.",
  EnforcedPause: "Badge minting is paused on the contract.",
  InvalidRecipient: "The learner's wallet address isn't valid.",
  InvalidModule: "A badge id isn't valid on the contract.",
  CapstoneAlreadyClaimed: "This wallet already holds the certificate.",
};

function hasMinterKey() {
  return /^(0x)?[0-9a-fA-F]{64}$/.test(env.MINTER_PRIVATE_KEY.trim());
}

/** Minting is possible once the contract address and the minter key are both configured. */
export function mintingEnabled() {
  return isAddress(env.CERTIFICATE_CONTRACT_ADDRESS) && hasMinterKey();
}

let cached: { provider: JsonRpcProvider; contract: Contract; wallet: Wallet } | null = null;

function connect() {
  if (!mintingEnabled()) throw new Error("On-chain minting isn't configured.");
  if (!cached) {
    const c = chain();
    // a fixed network: no extra network lookups, and a wrong RPC fails loudly
    const provider = new JsonRpcProvider(env.CERTIFICATE_RPC_URL.trim() || c.rpc, c.chainId, { staticNetwork: true });
    const key = env.MINTER_PRIVATE_KEY.trim();
    const wallet = new Wallet(key.startsWith("0x") ? key : `0x${key}`, provider);
    const contract = new Contract(env.CERTIFICATE_CONTRACT_ADDRESS, ABI, wallet);
    cached = { provider, contract, wallet };
  }
  return cached;
}

export interface SentMint {
  /** batchAwardModuleBadges, when any module badge was missing on-chain */
  badgesTxHash: string | null;
  /** awardCapstone, when the learner didn't hold the capstone yet */
  capstoneTxHash: string | null;
}

/**
 * Sends whatever the learner is still missing on-chain: the module badges for
 * `weeks` and the capstone. Reads the chain first, so retrying never re-awards
 * a badge. Transactions are sent, not awaited; confirm them with `receipt()`.
 */
export async function sendMint(learner: string, weeks: number[]): Promise<SentMint> {
  const { contract, wallet } = connect();
  if (await contract.paused()) throw new Error("Badge minting is paused on the contract.");

  const ids = [...new Set(weeks)].filter((w) => Number.isInteger(w) && w >= 1 && w <= MAX_MODULE_TOKEN_ID).sort((a, b) => a - b);
  const balances: bigint[] = ids.length ? await contract.balanceOfBatch(ids.map(() => learner), ids) : [];
  const missing = ids.filter((_, i) => balances[i] === BigInt(0));
  const needsCapstone = !(await contract.hasCapstoneBadge(learner));

  // explicit nonces, so two back-to-back sends never collide on a lagging RPC
  let nonce = await wallet.getNonce("pending");
  let badgesTxHash: string | null = null;
  let capstoneTxHash: string | null = null;
  if (missing.length > 0) {
    const tx = await contract.batchAwardModuleBadges(learner, missing, { nonce: nonce++ });
    badgesTxHash = tx.hash;
  }
  if (needsCapstone) {
    const tx = await contract.awardCapstone(learner, { nonce: nonce++ });
    capstoneTxHash = tx.hash;
  }
  return { badgesTxHash, capstoneTxHash };
}

/** The receipt once a transaction is mined; `null` while it's still pending. */
export async function receipt(txHash: string): Promise<TransactionReceipt | null> {
  return connect().provider.getTransactionReceipt(txHash);
}

/** Whether the learner holds the capstone on-chain (used when nothing needed sending). */
export async function holdsCapstone(learner: string): Promise<boolean> {
  return connect().contract.hasCapstoneBadge(learner);
}

/** A short, safe message for an RPC / contract error (never the raw payload). */
export function mintErrorMessage(err: unknown): string {
  const e = err as {
    shortMessage?: string;
    reason?: string;
    code?: string;
    message?: string;
    data?: string;
    revert?: { name?: string } | null;
  };
  if (e?.code === "INSUFFICIENT_FUNDS") return "The minting wallet is out of gas funds.";
  // ethers doesn't decode reverts raised while estimating gas, so decode the data here
  let name = e?.revert?.name;
  if (!name && typeof e?.data === "string" && e.data.startsWith("0x")) {
    try {
      name = new Interface(ABI).parseError(e.data)?.name;
    } catch {
      name = undefined;
    }
  }
  if (name && REVERT_MESSAGES[name]) return REVERT_MESSAGES[name];
  if (e?.reason) return `The contract rejected the mint (${e.reason}).`;
  if (/AccessControlUnauthorizedAccount/i.test(e?.message ?? "")) return REVERT_MESSAGES.AccessControlUnauthorizedAccount;
  return e?.shortMessage || "The mint couldn't be sent to the network.";
}
