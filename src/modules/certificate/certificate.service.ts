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
  chain,
  holdsCapstone,
  mintErrorMessage,
  mintingEnabled,
  receipt,
  sendMint,
} from "../../utils/badges-contract";
import { generateVerificationCode } from "../../utils/crypto";

/** A pending mint older than this can be retried (the chain is re-read first, so nothing is awarded twice). */
const STALE_MINT_MS = 10 * 60 * 1000;

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
  if (cert.status !== "minted" && cert.mint?.state === "pending") await settleMint(cert);
  if (cert.isNew || cert.isModified()) await cert.save();
  return { cert, user };
}

/**
 * Checks an in-flight mint against the chain. The certificate only becomes
 * "minted" once the capstone transaction is confirmed (or, if nothing had to be
 * sent, once the chain shows the capstone in the learner's wallet).
 */
async function settleMint(cert: ICertificate) {
  const m = cert.mint!;
  try {
    // the capstone is the certificate; the badges tx (if any) must not have failed either
    const hashes = [m.badgesTxHash, m.capstoneTxHash].filter((h): h is string => !!h);
    const receipts = await Promise.all(hashes.map((h) => receipt(h)));
    if (receipts.some((r) => r && r.status === 0)) {
      cert.mint = { ...m, state: "failed", error: "The mint transaction failed on-chain. Please try again." };
      return;
    }
    if (receipts.some((r) => !r)) return; // still pending

    const capstone = m.capstoneTxHash ? receipts[hashes.indexOf(m.capstoneTxHash)] : null;
    if (!capstone && !(await holdsCapstone(cert.recipientAddress))) {
      cert.mint = { ...m, state: "failed", error: "The certificate wasn't found on-chain. Please try again." };
      return;
    }
    const c = chain();
    cert.status = "minted";
    cert.tokenId = String(CAPSTONE_TOKEN_ID);
    cert.txHash = m.capstoneTxHash ?? m.badgesTxHash ?? undefined;
    cert.blockNumber = capstone?.blockNumber;
    cert.mintedAt = new Date();
    cert.chainId = c.chainId;
    cert.network = c.name;
    cert.mint = null;
  } catch (err) {
    // the RPC is unreachable: leave it pending and check again next time
    console.warn("⚠️ Could not check the mint on-chain:", (err as Error).message);
  }
}

function onChain(cert: ICertificate) {
  const c = chain();
  return {
    enabled: mintingEnabled(),
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
        return !!quiz?.isActive && quiz.questions.length > 0 && isQuizOpen(sessionState(m));
      })
      .map((m) => ({ week: m.week, title: m.title, slug: m.slug }));
    const prerequisite = modules.find((m) => m.isPrerequisiteForCertificate);

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
      onChain: onChain(cert),
      canMint:
        mintingEnabled() &&
        cert.status === "unlocked" &&
        isAddress(user.walletAddress ?? "") &&
        !(cert.mint?.state === "pending" && Date.now() - new Date(cert.mint.startedAt).getTime() < STALE_MINT_MS),
      // an in-flight mint (poll until it's minted) or the reason the last one failed
      mint: {
        pending: cert.mint?.state === "pending",
        error: cert.mint?.state === "failed" ? cert.mint.error ?? "The mint didn't go through." : null,
        txHash: cert.mint?.capstoneTxHash ?? cert.mint?.badgesTxHash ?? null,
        explorerUrl:
          cert.mint?.capstoneTxHash || cert.mint?.badgesTxHash
            ? `${chain().explorer}/tx/${cert.mint?.capstoneTxHash ?? cert.mint?.badgesTxHash}`
            : null,
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
   * Mints the learner's certificate on-chain from the server's minter wallet:
   * the module badges they earned (token id = week) and the capstone (13). The
   * transactions are sent and recorded as pending; the certificate becomes
   * "minted" only once the chain confirms them (see settleMint), which the
   * certificate page picks up by polling GET /certificate.
   */
  static async mint(userId: Types.ObjectId) {
    if (!mintingEnabled()) {
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "On-chain minting isn't open yet.");
    }
    const progress = await UserProgress.findOne({ user: userId });
    const { cert, user } = await syncCertificate(userId, progress);
    if (cert.status === "minted") return this.getCertificate(userId);
    if (cert.status !== "unlocked") throw ApiError.forbidden("Finish the cohort to unlock your certificate first.");
    const learner = user.walletAddress ?? "";
    if (!isAddress(learner)) throw ApiError.badRequest("Connect a wallet first, so the certificate has somewhere to go.");

    // One mint at a time per learner; a pending one older than STALE_MINT_MS can be retried
    const now = new Date();
    const locked = await Certificate.findOneAndUpdate(
      {
        _id: cert._id,
        status: "unlocked",
        $or: [
          { mint: null },
          { "mint.state": "failed" },
          { "mint.startedAt": { $lt: new Date(now.getTime() - STALE_MINT_MS) } },
        ],
      },
      { $set: { mint: { state: "pending", startedAt: now, badgesTxHash: null, capstoneTxHash: null, error: null } } },
      { new: true }
    );
    if (!locked) throw ApiError.conflict("Your certificate is already being minted.");

    try {
      const weeks = (await earnedBadges(progress)).map((b) => b.week).filter((w): w is number => w !== null);
      const sent = await sendMint(learner, weeks);
      await Certificate.updateOne(
        { _id: cert._id },
        { $set: { "mint.badgesTxHash": sent.badgesTxHash, "mint.capstoneTxHash": sent.capstoneTxHash } }
      );
    } catch (err) {
      const message = mintErrorMessage(err);
      console.error("❌ Certificate mint failed to send:", (err as Error).message);
      await Certificate.updateOne({ _id: cert._id }, { $set: { "mint.state": "failed", "mint.error": message } });
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, `${message} Please try again in a moment.`);
    }

    // settles straight away if nothing needed sending; otherwise returns it pending
    return this.getCertificate(userId);
  }
}
