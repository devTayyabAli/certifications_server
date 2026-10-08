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
import { ApiError } from "../../utils/api-error";
import { generateVerificationCode } from "../../utils/crypto";
import { RecordMintInput } from "./certificate.validation";

const CHAINS = {
  base: { name: "Base", chainId: 8453, explorer: "https://basescan.org" },
  "base-sepolia": { name: "Base Sepolia", chainId: 84532, explorer: "https://sepolia.basescan.org" },
} as const;

function chain() {
  return CHAINS[env.CERTIFICATE_CHAIN];
}

/** Minting is only possible once the certificate contract is configured. */
function mintingEnabled() {
  return /^0x[a-fA-F0-9]{40}$/.test(env.CERTIFICATE_CONTRACT_ADDRESS);
}

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
  if (cert.isNew || cert.isModified()) await cert.save();
  return { cert, user };
}

function onChain(cert: ICertificate) {
  const c = chain();
  return {
    enabled: mintingEnabled(),
    network: c.name,
    chainId: c.chainId,
    contractAddress: mintingEnabled() ? env.CERTIFICATE_CONTRACT_ADDRESS : null,
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
      canMint: mintingEnabled() && cert.status === "unlocked" && !!user.walletAddress,
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
      onChain: { ...onChain(cert), contractAddress: mintingEnabled() ? env.CERTIFICATE_CONTRACT_ADDRESS : null },
    };
  }

  static async prepareMint(_userId: Types.ObjectId) {
    // Until the certificate contract exists there is nothing honest to mint
    throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "On-chain minting isn't open yet.");
  }

  static async recordMint(_userId: Types.ObjectId, _data: RecordMintInput) {
    // Will verify the transaction on-chain once the contract is live; never
    // trust a client-supplied hash on its own
    throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "On-chain minting isn't open yet.");
  }
}
