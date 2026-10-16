import { Types } from "mongoose";
import { env } from "../../config/env";
import { COHORT_BADGE_TOTAL, LEGACY_ORIENTATION_BADGE_ID } from "../../constants/cohort";
import { HttpStatus } from "../../constants/http-status";
import { Certificate, ICertificate } from "../../models/certificate.model";
import { Module } from "../../models/module.model";
import { Profile } from "../../models/profile.model";
import { IUserProgress, UserProgress } from "../../models/progress.model";
import { Quiz } from "../../models/quiz.model";
import { Settings } from "../../models/settings.model";
import { User } from "../../models/user.model";
import { CmsCertificateService } from "../../services/cms-certificate.service";
import { ModuleCatalogService, isQuizOpen, sessionState } from "../../services/module-catalog.service";
import { isAddress } from "ethers";
import { ApiError } from "../../utils/api-error";
import {
  CAPSTONE_TOKEN_ID,
  MAX_MODULE_TOKEN_ID,
  badgeErrorMessage,
  buildVoucher,
  chain,
  checkClaimTx,
  claimsEnabled,
  heldTokenIds,
  holdsCapstone,
} from "../../utils/badges-contract";
import { generateVerificationCode } from "../../utils/crypto";

/** A claim still unconfirmed after this is treated as failed, so the learner can claim again. */
const STALE_CLAIM_MS = 15 * 60 * 1000;

function verifyUrl(code: string) {
  return `${env.FRONTEND_URL.replace(/\/+$/, "")}/credential/${encodeURIComponent(code)}`;
}

/** "Amara Rodrigues" → "A. R." for learners who keep their name private. */
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part[0]!.toUpperCase()}.`)
      .join(" ") || "Si Her DeFi learner"
  );
}

/** Module badges the learner holds, oldest week first, with the module they came from. */
async function earnedBadges(progress: IUserProgress | null) {
  const badges = (progress?.earnedBadges ?? []).filter((b) => b.badgeId !== LEGACY_ORIENTATION_BADGE_ID);
  const moduleIds = badges.map((b) => b.sourceModuleId).filter(Boolean);
  const modules = await Module.find({ _id: { $in: moduleIds } }, { week: 1, title: 1, slug: 1 });
  const byId = new Map(modules.map((m) => [m._id.toString(), m]));

  return badges
    .map((b) => {
      const m = b.sourceModuleId ? byId.get(b.sourceModuleId.toString()) : undefined;
      return {
        name: b.name,
        image: b.image,
        earnedAt: b.earnedAt,
        week: m?.week ?? null,
        moduleTitle: m?.title ?? null,
        moduleSlug: m?.slug ?? null,
      };
    })
    .sort((a, b) => (a.week ?? 99) - (b.week ?? 99));
}

/**
 * Published modules the learner hasn't finished (passed, or skipped after
 * using every attempt). The certificate can only be claimed on-chain once
 * this is empty; until then it's shown as it fills up with badges.
 */
async function modulesLeft(progress: IUserProgress | null) {
  const modules = await Module.find({ isPublished: true }, { week: 1, title: 1, slug: 1 }).sort({ week: 1 });
  const passed = new Set((progress?.completedModules ?? []).map((id) => id.toString()));
  const skippedQuizIds = (progress?.skippedQuizzes ?? []).map((s) => s.quiz);
  const skipped = new Set(
    skippedQuizIds.length
      ? (await Quiz.find({ _id: { $in: skippedQuizIds } }, { module: 1 })).map((q) => q.module.toString())
      : []
  );
  return modules.filter((m) => !passed.has(m._id.toString()) && !skipped.has(m._id.toString()));
}

/** Makes sure the certificate record matches the learner's current progress. */
async function syncCertificate(userId: Types.ObjectId, progress: IUserProgress | null) {
  const [profile, user] = await Promise.all([Profile.findOne({ user: userId }), User.findById(userId)]);
  if (!user) throw ApiError.notFound("User not found");

  const passedPrerequisite = progress?.hasPassedPrerequisiteForCertificate ?? false;
  const badgeCount = (progress?.earnedBadges ?? []).filter((b) => b.badgeId !== LEGACY_ORIENTATION_BADGE_ID).length;

  let cert = await Certificate.findOne({ user: userId });
  if (!cert) {
    cert = new Certificate({
      user: userId,
      status: passedPrerequisite ? "unlocked" : "locked",
      unlockedAt: passedPrerequisite ? new Date() : undefined,
      verificationCode: generateVerificationCode(),
    });
  } else if (cert.status === "locked" && passedPrerequisite) {
    cert.status = "unlocked";
    cert.unlockedAt = new Date();
  }

  // Older records used a guessable, timestamp-based code — replace it
  if (!cert.verificationCode?.startsWith("SHD-")) cert.verificationCode = generateVerificationCode();
  if (cert.status !== "locked" && !cert.unlockedAt) cert.unlockedAt = cert.updatedAt ?? new Date();

  // A minted certificate is frozen; everything else follows the profile
  if (cert.status !== "minted") {
    cert.recipientName = profile?.name?.trim() || "";
    if (user.walletAddress) cert.recipientAddress = user.walletAddress;
    cert.earnedBadgesCount = badgeCount;
    cert.totalBadgesCount = COHORT_BADGE_TOTAL;
  }
  if (cert.mint?.state === "pending" && user.walletAddress) await settleClaim(cert, user.walletAddress);
  if (cert.isNew || cert.isModified()) await cert.save();
  return { cert, user };
}

/**
 * Checks the learner's claim transaction against the chain. It counts only if
 * it's mined, succeeded, came from the learner's own wallet and went to the
 * badges contract. The certificate becomes "minted" once that's confirmed and
 * the wallet holds the capstone; a badges-only claim just clears.
 */
async function settleClaim(cert: ICertificate, wallet: string) {
  const m = cert.mint!;
  if (!m.txHash) return;
  try {
    const check = await checkClaimTx(m.txHash, wallet);
    if (check.state === "pending") {
      if (Date.now() - new Date(m.startedAt).getTime() > STALE_CLAIM_MS) {
        cert.mint = { ...m, state: "failed", error: "The claim wasn't confirmed on-chain. Please try again." };
      }
      return;
    }
    if (check.state === "failed") {
      cert.mint = { ...m, state: "failed", error: check.reason };
      return;
    }
    if (cert.status === "unlocked" && (await holdsCapstone(wallet))) {
      const c = chain();
      cert.status = "minted";
      cert.tokenId = String(CAPSTONE_TOKEN_ID);
      cert.txHash = m.txHash;
      cert.blockNumber = check.receipt.blockNumber;
      cert.mintedAt = new Date();
      cert.chainId = c.chainId;
      cert.network = c.name;
      cert.recipientAddress = wallet;
    }
    cert.mint = null;
  } catch (err) {
    // the RPC is unreachable: leave it pending and check again next time
    console.warn("⚠️ Could not check the claim on-chain:", (err as Error).message);
  }
}

function onChain(cert: ICertificate) {
  const c = chain();
  return {
    enabled: claimsEnabled(),
    network: cert.status === "minted" && cert.network ? cert.network : c.name,
    chainId: cert.status === "minted" && cert.chainId ? cert.chainId : c.chainId,
    // shown for a minted certificate even if minting is later switched off
    contractAddress: isAddress(env.CERTIFICATE_CONTRACT_ADDRESS) ? env.CERTIFICATE_CONTRACT_ADDRESS : null,
    tokenId: cert.tokenId ?? null,
    txHash: cert.txHash ?? null,
    mintedAt: cert.mintedAt ?? null,
    explorerUrl: cert.txHash ? `${c.explorer}/tx/${cert.txHash}` : null,
  };
}

export class CertificateService {
  /** Everything the learner's certificate page shows. */
  static async getCertificate(userId: Types.ObjectId) {
    await ModuleCatalogService.ensureSynced();
    const progress = await UserProgress.findOne({ user: userId });
    const [{ cert, user }, content, badges] = await Promise.all([
      syncCertificate(userId, progress),
      CmsCertificateService.getContent(),
      earnedBadges(progress),
    ]);

    // Modules still to pass — what the "Still open" card links to
    const modules = await Module.find({ isPublished: true }).sort({ week: 1 });
    const quizzes = await Quiz.find({ module: { $in: modules.map((m) => m._id) } });
    const passedModuleIds = new Set((progress?.completedModules ?? []).map((id) => id.toString()));
    const stillOpen = modules
      .filter((m) => !passedModuleIds.has(m._id.toString()))
      .filter((m) => {
        const quiz = quizzes.find((q) => q.module.toString() === m._id.toString());
        return !!quiz?.isActive && quiz.questions.length > 0 && isQuizOpen(sessionState(m), m.quizOpen);
      })
      .map((m) => ({ week: m.week, title: m.title, slug: m.slug }));
    const prerequisite = modules.find((m) => m.isPrerequisiteForCertificate);
    const left = await modulesLeft(progress);
    const allModulesDone = left.length === 0;

    // What's already in the learner's wallet, so the page knows what's left to claim
    const wallet = isAddress(user.walletAddress ?? "") ? user.walletAddress! : null;
    const earnedWeeks = badges
      .map((b) => b.week)
      .filter((w): w is number => w !== null && w >= 1 && w <= MAX_MODULE_TOKEN_ID);
    let held: Set<number> | null = null;
    if (claimsEnabled() && wallet) {
      try {
        held = await heldTokenIds(wallet, [...new Set([...earnedWeeks, CAPSTONE_TOKEN_ID])]);
      } catch (err) {
        console.warn("⚠️ Could not read the wallet's badges on-chain:", (err as Error).message);
      }
    }
    const claimable = held
      ? {
          moduleIds: [...new Set(earnedWeeks)].filter((w) => !held!.has(w)).sort((a, b) => a - b),
          // the certificate itself only once every module is done
          capstone: cert.status === "unlocked" && allModulesDone && !held.has(CAPSTONE_TOKEN_ID),
        }
      : null;
    const claimPending =
      cert.mint?.state === "pending" && Date.now() - new Date(cert.mint.startedAt).getTime() < STALE_CLAIM_MS;

    return {
      status: cert.status,
      recipientName: cert.recipientName,
      walletAddress: user.walletAddress ?? null,
      issuedAt: cert.status === "locked" ? null : cert.unlockedAt ?? null,
      verificationCode: cert.status === "locked" ? null : cert.verificationCode,
      verifyUrl: cert.status === "locked" ? null : verifyUrl(cert.verificationCode),
      unlockModule: prerequisite ? { week: prerequisite.week, title: prerequisite.title, slug: prerequisite.slug } : null,
      content,
      badges,
      totalBadges: COHORT_BADGE_TOTAL,
      stillOpen,
      // the certificate can be claimed on-chain only when every module is done
      allModulesDone,
      modulesLeft: left.map((m) => ({ week: m.week, title: m.title, slug: m.slug })),
      onChain: onChain(cert),
      // earned badges (and the certificate, once unlocked) not yet in the wallet; null if unknown
      claimable,
      // true when the learner can claim something now from their own wallet
      canMint:
        claimsEnabled() &&
        !!wallet &&
        !claimPending &&
        !!claimable &&
        (claimable.moduleIds.length > 0 || claimable.capstone),
      // the claim transaction while it confirms (poll until settled), or why the last one failed
      mint: {
        pending: claimPending,
        error: cert.mint?.state === "failed" ? cert.mint.error ?? "The claim didn't go through." : null,
        txHash: cert.mint?.txHash ?? null,
        explorerUrl: cert.mint?.txHash ? `${chain().explorer}/tx/${cert.mint.txHash}` : null,
      },
    };
  }

  /**
   * Public verification, by the code printed on the certificate. Only issued
   * (unlocked or minted) certificates verify. Learners who switched off
   * "show my name" in Settings appear by initials only.
   */
  static async verifyCertificatePublic(identifier: string) {
    const code = identifier.trim().toUpperCase();
    if (!/^SHD-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) {
      throw ApiError.notFound("No certificate matches this code.");
    }
    const cert = await Certificate.findOne({ verificationCode: code, status: { $in: ["unlocked", "minted"] } });
    if (!cert) throw ApiError.notFound("No certificate matches this code.");

    const [settings, progress, content] = await Promise.all([
      Settings.findOne({ user: cert.user }),
      UserProgress.findOne({ user: cert.user }),
      CmsCertificateService.getContent(),
    ]);
    const showName = settings?.onChainVerificationPrivacy ?? true;
    const badges = await earnedBadges(progress);

    return {
      isValid: true,
      verificationCode: cert.verificationCode,
      recipientName: showName ? cert.recipientName || "Si Her DeFi learner" : initials(cert.recipientName),
      nameHidden: !showName,
      status: cert.status,
      issuedAt: cert.unlockedAt ?? cert.updatedAt,
      content,
      badges: badges.map(({ name, image, week, moduleTitle }) => ({ name, image, week, moduleTitle })),
      totalBadges: COHORT_BADGE_TOTAL,
      onChain: onChain(cert),
    };
  }

  /**
   * A signed voucher the learner's wallet sends to `claim()` on the contract:
   * every module badge they've earned that isn't in their wallet yet, plus the
   * certificate once it's unlocked and every module is done. The learner signs and pays the gas; the
   * contract checks the voucher, so nothing unearned can be claimed.
   */
  static async claimVoucher(userId: Types.ObjectId) {
    if (!claimsEnabled()) throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Badge claiming isn't open yet.");
    const progress = await UserProgress.findOne({ user: userId });
    const { cert, user } = await syncCertificate(userId, progress);
    const wallet = user.walletAddress ?? "";
    if (!isAddress(wallet)) throw ApiError.badRequest("Connect a wallet first, so your badges have somewhere to go.");
    if (cert.mint?.state === "pending" && Date.now() - new Date(cert.mint.startedAt).getTime() < STALE_CLAIM_MS) {
      throw ApiError.conflict("Your last claim is still confirming. Please wait a moment.");
    }

    const weeks = (await earnedBadges(progress)).map((b) => b.week).filter((w): w is number => w !== null);
    let voucher;
    try {
      const allDone = (await modulesLeft(progress)).length === 0;
      voucher = await buildVoucher(wallet, weeks, cert.status === "unlocked" && allDone);
    } catch (err) {
      console.error("❌ Could not prepare a claim voucher:", (err as Error).message);
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, `${badgeErrorMessage(err)} Please try again in a moment.`);
    }
    if (!voucher) throw ApiError.conflict("Everything you've earned is already in your wallet.");
    return voucher;
  }

  /**
   * Records the claim transaction the learner's wallet sent, then checks it on
   * the chain (see settleClaim). The hash is only a pointer: it must turn out
   * to be the learner's own successful transaction to this contract.
   */
  static async recordClaim(userId: Types.ObjectId, txHash: string) {
    if (!claimsEnabled()) throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Badge claiming isn't open yet.");
    const progress = await UserProgress.findOne({ user: userId });
    const { cert, user } = await syncCertificate(userId, progress);
    if (!isAddress(user.walletAddress ?? "")) throw ApiError.badRequest("Connect a wallet first.");

    await Certificate.updateOne(
      { _id: cert._id },
      { $set: { mint: { state: "pending", startedAt: new Date(), txHash, error: null } } }
    );
    // settles right away if it's already mined; otherwise comes back pending
    return this.getCertificate(userId);
  }
}
