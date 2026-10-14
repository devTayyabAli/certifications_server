import { Contract, Interface, JsonRpcProvider, TransactionReceipt, Wallet, getAddress, isAddress } from "ethers";
import { env } from "../config/env";

/**
 * The LearningBadges contract (soulbound ERC-1155): module badges 1–12 (token
 * id = the module's week) and the capstone (13, the certificate).
 *
 * Learners claim their own badges: the server signs an EIP-712 voucher saying
 * what the learner has earned, and the learner's wallet sends `claim()` with
 * it (paying their own gas). The server's key only signs vouchers: it holds no
 * funds, sends no transactions, and has no minting rights of its own.
 */

export const CAPSTONE_TOKEN_ID = 13;
export const MAX_MODULE_TOKEN_ID = 12;
/** how long a voucher stays valid; a new one is signed on every claim */
const VOUCHER_TTL_SECONDS = 30 * 60;

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

export const BADGES_ABI = [
  "function claim(uint256[] moduleIds, bool capstone, uint256 deadline, bytes signature)",
  "function nonces(address learner) view returns (uint256)",
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
  "error VoucherExpired()",
  "error InvalidVoucher()",
  "error NothingToClaim()",
];

const REVERT_MESSAGES: Record<string, string> = {
  AccessControlUnauthorizedAccount: "That wallet isn't allowed to do this on the contract.",
  EnforcedPause: "Badge claiming is paused on the contract.",
  InvalidRecipient: "The wallet address isn't valid.",
  InvalidModule: "A badge id isn't valid on the contract.",
  CapstoneAlreadyClaimed: "This wallet already holds the certificate.",
  VoucherExpired: "The claim expired. Please start the claim again.",
  InvalidVoucher: "The claim couldn't be verified. Please start the claim again.",
  NothingToClaim: "Everything you've earned is already in your wallet.",
};

const EIP712_TYPES = {
  Claim: [
    { name: "learner", type: "address" },
    { name: "moduleIds", type: "uint256[]" },
    { name: "capstone", type: "bool" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

function signerKey() {
  const key = env.CLAIM_SIGNER_PRIVATE_KEY.trim();
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key)) return null;
  return key.startsWith("0x") ? key : `0x${key}`;
}

/** Claiming is possible once the contract address and the voucher signing key are both configured. */
export function claimsEnabled() {
  return isAddress(env.CERTIFICATE_CONTRACT_ADDRESS) && signerKey() !== null;
}

let cached: { provider: JsonRpcProvider; contract: Contract } | null = null;

/** Read-only connection to the contract (no wallet: the server never sends transactions). */
function connect() {
  if (!isAddress(env.CERTIFICATE_CONTRACT_ADDRESS)) throw new Error("The badges contract isn't configured.");
  if (!cached) {
    const c = chain();
    // a fixed network: no extra network lookups, and a wrong RPC fails loudly
    const provider = new JsonRpcProvider(env.CERTIFICATE_RPC_URL.trim() || c.rpc, c.chainId, { staticNetwork: true });
    cached = { provider, contract: new Contract(env.CERTIFICATE_CONTRACT_ADDRESS, BADGES_ABI, provider) };
  }
  return cached;
}

/** Which of the given token ids the wallet already holds. */
export async function heldTokenIds(learner: string, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const balances: bigint[] = await connect().contract.balanceOfBatch(ids.map(() => learner), ids);
  return new Set(ids.filter((_, i) => balances[i] > BigInt(0)));
}

export interface ClaimVoucher {
  contract: string;
  chainId: number;
  learner: string;
  moduleIds: number[];
  capstone: boolean;
  nonce: string;
  deadline: number;
  signature: string;
}

/**
 * A signed voucher for everything the learner has earned but doesn't hold yet:
 * the module badges for `weeks`, plus the capstone when `includeCapstone`.
 * `null` when there's nothing new to claim.
 */
export async function buildVoucher(learnerAddress: string, weeks: number[], includeCapstone: boolean): Promise<ClaimVoucher | null> {
  const key = signerKey();
  if (!key) throw new Error("Badge claiming isn't configured.");
  const { contract } = connect();
  if (await contract.paused()) throw new Error("Badge claiming is paused on the contract.");

  const learner = getAddress(learnerAddress);
  const ids = [...new Set(weeks)]
    .filter((w) => Number.isInteger(w) && w >= 1 && w <= MAX_MODULE_TOKEN_ID)
    .sort((a, b) => a - b);
  const held = await heldTokenIds(learner, [...ids, CAPSTONE_TOKEN_ID]);
  const moduleIds = ids.filter((id) => !held.has(id));
  const capstone = includeCapstone && !held.has(CAPSTONE_TOKEN_ID);
  if (moduleIds.length === 0 && !capstone) return null;

  const c = chain();
  const nonce: bigint = await contract.nonces(learner);
  const deadline = Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS;
  const domain = { name: "LearningBadges", version: "1", chainId: c.chainId, verifyingContract: getAddress(env.CERTIFICATE_CONTRACT_ADDRESS) };
  const signature = await new Wallet(key).signTypedData(domain, EIP712_TYPES, { learner, moduleIds, capstone, nonce, deadline });

  return { contract: domain.verifyingContract, chainId: c.chainId, learner, moduleIds, capstone, nonce: nonce.toString(), deadline, signature };
}

export type ClaimCheck =
  | { state: "pending" }
  | { state: "failed"; reason: string }
  | { state: "confirmed"; receipt: TransactionReceipt };

/**
 * Checks a claim transaction the learner reports: it must be mined, succeed,
 * be sent from the learner's own wallet, and go to this contract. A hash the
 * learner made up, or someone else's transaction, never counts.
 */
export async function checkClaimTx(txHash: string, learnerAddress: string): Promise<ClaimCheck> {
  const rcpt = await connect().provider.getTransactionReceipt(txHash);
  // not mined yet (or not found): the caller gives up after STALE_CLAIM_MS
  if (!rcpt) return { state: "pending" };
  const learner = getAddress(learnerAddress);
  const target = getAddress(env.CERTIFICATE_CONTRACT_ADDRESS);
  if (getAddress(rcpt.from) !== learner) return { state: "failed", reason: "That transaction wasn't sent from your wallet." };
  if (!rcpt.to || getAddress(rcpt.to) !== target) return { state: "failed", reason: "That transaction isn't a badge claim." };
  if (rcpt.status !== 1) return { state: "failed", reason: "The claim transaction failed on-chain. Please try again." };
  return { state: "confirmed", receipt: rcpt };
}

/** Whether the wallet holds the capstone (the certificate) on-chain. */
export async function holdsCapstone(learner: string): Promise<boolean> {
  return connect().contract.hasCapstoneBadge(learner);
}

/** A short, safe message for an RPC / contract error (never the raw payload). */
export function badgeErrorMessage(err: unknown): string {
  const e = err as {
    shortMessage?: string;
    reason?: string;
    code?: string;
    message?: string;
    data?: string;
    revert?: { name?: string } | null;
  };
  // ethers doesn't decode reverts raised while estimating gas, so decode the data here
  let name = e?.revert?.name;
  if (!name && typeof e?.data === "string" && e.data.startsWith("0x")) {
    try {
      name = new Interface(BADGES_ABI).parseError(e.data)?.name;
    } catch {
      name = undefined;
    }
  }
  if (name && REVERT_MESSAGES[name]) return REVERT_MESSAGES[name];
  if (e?.reason) return `The contract rejected the claim (${e.reason}).`;
  return e?.shortMessage || e?.message || "The badges contract couldn't be reached.";
}
