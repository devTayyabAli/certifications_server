import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { CalendarSchedule } from "../models/calendar-schedule.model";
import { Certificate } from "../models/certificate.model";
import { Module } from "../models/module.model";
import { Partner } from "../models/partner.model";
import { Profile } from "../models/profile.model";
import { UserProgress } from "../models/progress.model";
import { Quiz } from "../models/quiz.model";
import { Settings } from "../models/settings.model";
import { User } from "../models/user.model";

async function seed() {
  console.log("🌱 Seeding Si Her DeFi database...");
  await connectDatabase();

  // Clear existing core content (modules, quizzes, partners, calendar schedules)
  await Module.deleteMany({});
  await Quiz.deleteMany({});
  await Partner.deleteMany({});
  await CalendarSchedule.deleteMany({});

  console.log("🧹 Cleaned existing modules, quizzes, partners, and calendar schedules.");

  // 1. Create Learning Modules
  const module1 = await Module.create({
    slug: "collective-capital-for-creators",
    title: "Collective Capital for Creators",
    week: 1,
    dateLabel: "WEEK 01 · SEP 24",
    tag: "ORIENTATION & CAPITAL",
    presenter: "Artist Fund & Si Her DAO",
    companyTag: "Artist Fund",
    description:
      "Hands-on intro: how community funds flow to creators and on-chain treasuries. Complete this task to unlock your on-chain certificate on Base.",
    aboutText: [
      "Collective capital models empower creator economies by decentralizing funding decisions directly to communities.",
      "In this hands-on workshop, discover treasury management on Base and earn your Collective Capital badge.",
    ],
    thumbnailUrl: "/The Global Stablecoin Market.png",
    videoDurationSeconds: 1240,
    isPrerequisiteForCertificate: true,
    order: 1,
    scheduledDate: new Date("2026-09-24T17:00:00Z"),
    endDate: new Date("2026-09-24T18:00:00Z"),
    sessionStatus: "completed",
    calendarTitle: "Si Her DeFi: Collective Capital for Creators",
    calendarDescription: "Hands-on intro: how community funds flow to creators and on-chain treasuries on Base.",
    chapters: [
      { time: "0:00", title: "Introduction to Creator Treasuries" },
      { time: "3:15", title: "Community Allocation Mechanisms" },
      { time: "7:40", title: "Smart Contract Treasury Architecture" },
      { time: "12:10", title: "Case Studies on Base" },
      { time: "18:00", title: "Q&A and Hands-on Task" },
    ],
    speakers: [
      {
        name: "Kara Howard",
        role: "Founder & Lead",
        companyTag: "Si<3>",
        companyName: "Si Her DeFi",
        links: {
          website: "https://siherdefi.org",
          x: "https://x.com/si3dao",
          linkedin: "https://linkedin.com/company/si3-dao",
        },
      },
      {
        name: "Marcus Vance",
        role: "Treasury Architect",
        companyTag: "Artist Fund",
        companyName: "Artist Fund",
        links: {
          x: "https://x.com",
          linkedin: "https://linkedin.com",
        },
      },
    ],
  });

  const module2 = await Module.create({
    slug: "global-stablecoin-market",
    title: "The Global Stablecoin Market",
    week: 4,
    dateLabel: "WEEK 04 · OCT 19",
    tag: "STABLECOINS & RAILS",
    presenter: "KAST",
    companyTag: "KAST",
    description:
      "Stablecoins are the part of DeFi most people touch first — and the part most often explained badly. This session covers what actually sits behind a stablecoin, how to check it for yourself, and why the same token behaves differently depending on where you are in the world.",
    aboutText: [
      "Stablecoins are the part of DeFi most people touch first — and the part most often explained badly. This session covers what actually sits behind a stablecoin, how to check it for yourself, and why the same token behaves differently depending on where you are in the world.",
      "KAST leads the session with examples from markets where stablecoins are already doing the work banks don’t.",
    ],
    thumbnailUrl: "/stablecoins-thumb.jpg",
    videoDurationSeconds: 1366, // 22:46
    isPrerequisiteForCertificate: false,
    order: 2,
    scheduledDate: new Date("2026-10-19T17:00:00Z"),
    endDate: new Date("2026-10-19T18:00:00Z"),
    sessionStatus: "active",
    calendarTitle: "Si Her DeFi: The Global Stablecoin Market",
    calendarDescription: "What actually backs a stablecoin, how they move across markets, and where regulation is heading. Presented by KAST.",
    chapters: [
      { time: "0:00", title: "What a stablecoin actually is" },
      { time: "1:22", title: "What backs them — and how you check" },
      { time: "5:04", title: "Moving money across borders" },
      { time: "8:15", title: "Where regulation is heading" },
      { time: "8:56", title: "Questions from the cohort" },
    ],
    speakers: [
      {
        name: "Sanmi Adeyemi",
        role: "Co-founder & CEO",
        companyTag: "KAST",
        companyName: "KAST",
        links: {
          website: "https://kast.money",
          x: "https://x.com",
          linkedin: "https://linkedin.com",
        },
      },
      {
        name: "Priya Raman",
        role: "Head of Payments",
        companyTag: "KAST",
        companyName: "KAST",
        links: {
          x: "https://x.com",
          linkedin: "https://linkedin.com",
        },
      },
    ],
  });

  const module3 = await Module.create({
    slug: "portfolio-alerts-tokenizing-what-matters",
    title: "Portfolio Alerts (Real World): Tokenizing What Matters",
    week: 5,
    dateLabel: "WEEK 05 · OCT 21",
    tag: "REAL WORLD ASSETS",
    presenter: "Rarible & Si Her DAO",
    companyTag: "Rarible",
    description:
      "How real-world assets and provenance are tokenized, monitored with real-time portfolio alerts, and integrated into decentralized creator protocols.",
    aboutText: [
      "Tokenizing real-world assets unlocks liquid markets for physical items and intellectual property.",
      "Explore live alerts and automated portfolio triggers on Base.",
    ],
    thumbnailUrl: "/The Global Stablecoin Market.png",
    videoDurationSeconds: 1180,
    isPrerequisiteForCertificate: false,
    order: 3,
    scheduledDate: new Date("2026-10-21T17:00:00Z"),
    endDate: new Date("2026-10-21T18:00:00Z"),
    sessionStatus: "upcoming",
    calendarTitle: "Si Her DeFi: Portfolio Alerts (Real World): Tokenizing What Matters",
    calendarDescription: "Join Rarible & Si Her DAO for Week 5: Tokenizing What Matters.\nLocation: Si Her DeFi Virtual Stage",
    chapters: [
      { time: "0:00", title: "Introduction to RWA Tokenization" },
      { time: "4:30", title: "Setting up Portfolio Alert Triggers" },
      { time: "10:15", title: "Rarible Market Infrastructure" },
    ],
    speakers: [
      {
        name: "Alex Salnikov",
        role: "Co-founder",
        companyTag: "Rarible",
        companyName: "Rarible",
        links: {
          website: "https://rarible.com",
        },
      },
    ],
  });

  const module4 = await Module.create({
    slug: "trading-with-confidence-derivatives",
    title: "Trading With Confidence (With Derivatives)",
    week: 6,
    dateLabel: "WEEK 06 · OCT 28",
    tag: "DERIVATIVES & RISK",
    presenter: "Si Her DeFi Trading Desk",
    companyTag: "DEFI RISK",
    description:
      "Demystifying on-chain options, perpetual contracts, and hedging mechanisms. Learn how to protect capital while navigating decentralized liquidity pools.",
    aboutText: [
      "Risk management is the hallmark of sophisticated on-chain capital stewards.",
      "A hands-on walk-through of options, perps, and delta-neutral positioning on Base.",
    ],
    thumbnailUrl: "/The Global Stablecoin Market.png",
    videoDurationSeconds: 1420,
    isPrerequisiteForCertificate: false,
    order: 4,
    scheduledDate: new Date("2026-10-28T17:00:00Z"),
    endDate: new Date("2026-10-28T18:00:00Z"),
    sessionStatus: "upcoming",
    calendarTitle: "Si Her DeFi: Trading With Confidence (With Derivatives)",
    calendarDescription: "Week 6 cohort workshop: Hedging and derivatives fundamentals on Base.\nLocation: Si Her DeFi Virtual Stage",
    chapters: [
      { time: "0:00", title: "Risk Management 101" },
      { time: "5:20", title: "How Perpetual Futures Work" },
      { time: "11:45", title: "Hedging Strategies on L2" },
    ],
    speakers: [
      {
        name: "Elena Rostova",
        role: "Derivatives Lead",
        companyTag: "DEFI RISK",
        companyName: "Si Her DeFi Trading Desk",
        links: {
          website: "https://siherdefi.org",
        },
      },
    ],
  });

  const module5 = await Module.create({
    slug: "decentralized-futures",
    title: "Decentralized Futures",
    week: 7,
    dateLabel: "WEEK 07 · NOV 4",
    tag: "SYNTHETICS & FUTURES",
    presenter: "Synthetix & Si Her Protocol",
    companyTag: "SYNTHETIX",
    description:
      "Deep dive into decentralized future contracts, virtual automated market makers (vAMMs), synthetic asset collateral, and multi-collateral margin accounts.",
    aboutText: [
      "Decentralized futures remove central clearinghouses and execute liquidations strictly via audited smart contracts.",
      "Explore how synthetic architecture drives modern DeFi capital efficiency.",
    ],
    thumbnailUrl: "/The Global Stablecoin Market.png",
    videoDurationSeconds: 1300,
    isPrerequisiteForCertificate: false,
    order: 5,
    scheduledDate: new Date("2026-11-04T17:00:00Z"),
    endDate: new Date("2026-11-04T18:00:00Z"),
    sessionStatus: "upcoming",
    calendarTitle: "Si Her DeFi: Decentralized Futures",
    calendarDescription: "Week 7 cohort workshop: Synthetic futures mechanics and liquidity pools.\nLocation: Si Her DeFi Virtual Stage",
    chapters: [
      { time: "0:00", title: "The Architecture of Synthetic Assets" },
      { time: "6:10", title: "Decentralized Margin & Liquidations" },
      { time: "12:00", title: "Synthetix Ecosystem on Base" },
    ],
    speakers: [
      {
        name: "Kain Warwick",
        role: "Founder",
        companyTag: "SYNTHETIX",
        companyName: "Synthetix",
        links: {
          website: "https://synthetix.io",
        },
      },
    ],
  });

  console.log("✅ Modules created (5 modules seeded with calendar schedules).");


  // 2. Create Quizzes
  await Quiz.create({
    module: module2._id,
    title: "The Global Stablecoin Market Quiz",
    maxAttempts: 3,
    passingScore: 5,
    badgeRewardName: "Week 4 Badge — Global Stablecoin Market",
    badgeRewardImage: "/Badge_earned.png",
    questions: [
      {
        questionNumber: 1,
        questionText: "What distinguishes fiat-backed stablecoins from algorithmic stablecoins?",
        options: [
          { key: "A", text: "Fiat-backed stablecoins hold real-world currency or cash-equivalent reserves" },
          { key: "B", text: "Algorithmic stablecoins are backed by government central bank guarantees" },
          { key: "C", text: "Fiat-backed stablecoins have no smart contracts" },
          { key: "D", text: "Algorithmic stablecoins cannot be traded on decentralized exchanges" },
        ],
        correctOption: "A",
        explanation: "Fiat-backed stablecoins are collateralized by liquid cash or high-quality short-dated bonds.",
        hintTimestamp: "0:00",
        hintTitle: "What a stablecoin actually is",
      },
      {
        questionNumber: 2,
        questionText: "A stablecoin says it is fully backed. What would you check first?",
        options: [
          { key: "A", text: "Its market cap on a price tracker" },
          { key: "B", text: "A recent third-party attestation of reserves" },
          { key: "C", text: "How many exchanges list it" },
          { key: "D", text: "The size of its community on X" },
        ],
        correctOption: "B",
        explanation:
          "An attestation by a third party confirming the reserves exist. Market cap and exchange listings tell you nothing about what is actually backing the token.",
        hintTimestamp: "1:22",
        hintTitle: "What backs them — and how you check",
      },
      {
        questionNumber: 3,
        questionText: "How do cross-border payment rails use stablecoins to minimize settlement friction?",
        options: [
          { key: "A", text: "By bypassing blockchain consensus rules" },
          { key: "B", text: "By settling instantly 24/7 on L2 networks without correspondent banking delays" },
          { key: "C", text: "By locking funds for 3-5 business days" },
          { key: "D", text: "By requiring physical paper documentation" },
        ],
        correctOption: "B",
        explanation: "Blockchain settlement allows real-time liquidity movement across borders without legacy clearing house delays.",
        hintTimestamp: "5:04",
        hintTitle: "Moving money across borders",
      },
      {
        questionNumber: 4,
        questionText: "What regulatory framework trend is most common globally for stablecoin issuers?",
        options: [
          { key: "A", text: "Total deregulation with zero audits required" },
          { key: "B", text: "Requirement for 1:1 liquid reserve backing, licensing, and transparency" },
          { key: "C", text: "Mandatory algorithmic minting mechanisms" },
          { key: "D", text: "Banning any wallet addresses on Ethereum" },
        ],
        correctOption: "B",
        explanation: "Major jurisdictions (EU MiCA, US proposed frameworks) require 1:1 reserve backing and strict supervisory compliance.",
        hintTimestamp: "8:15",
        hintTitle: "Where regulation is heading",
      },
      {
        questionNumber: 5,
        questionText: "Why is Base Mainnet frequently chosen for consumer stablecoin transfers?",
        options: [
          { key: "A", text: "Sub-cent transaction fees and fast finality backed by Ethereum security" },
          { key: "B", text: "It runs without internet connectivity" },
          { key: "C", text: "It has zero smart contracts" },
          { key: "D", text: "It restricts tokens to only one issuer" },
        ],
        correctOption: "A",
        explanation: "Base provides high throughput and negligible gas fees, making micropayments and retail stablecoin usage practical.",
        hintTimestamp: "8:56",
        hintTitle: "Questions from the cohort",
      },
    ],
  });

  await Quiz.create({
    module: module1._id,
    title: "Collective Capital for Creators Quiz",
    maxAttempts: 3,
    passingScore: 5,
    badgeRewardName: "Week 1 Badge — Collective Capital",
    badgeRewardImage: "/Badge_earned.png",
    questions: [
      {
        questionNumber: 1,
        questionText: "What is the primary role of an on-chain community treasury?",
        options: [
          { key: "A", text: "To hold and allocate community funds transparently via verifiable votes" },
          { key: "B", text: "To store private user passwords" },
          { key: "C", text: "To print unlimited physical currency" },
          { key: "D", text: "To replace individual digital wallets" },
        ],
        correctOption: "A",
        explanation: "On-chain treasuries enforce transparent, verifiable rules for how shared resources are distributed.",
      },
      {
        questionNumber: 2,
        questionText: "How can creators verify that grant funding has been disbursed?",
        options: [
          { key: "A", text: "Checking on-chain block explorer records (e.g. BaseScan)" },
          { key: "B", text: "Waiting for paper postal slips" },
          { key: "C", text: "Calling a centralized bank teller" },
          { key: "D", text: "Checking social media hashtags" },
        ],
        correctOption: "A",
        explanation: "Every transfer on Base is verifiable publicly on BaseScan.",
      },
      {
        questionNumber: 3,
        questionText: "What is a multi-signature treasury wallet (like Safe)?",
        options: [
          { key: "A", text: "A wallet requiring multiple designated keys to approve a transaction before execution" },
          { key: "B", text: "A wallet that only signs one single transaction forever" },
          { key: "C", text: "A wallet stored on physical paper only" },
          { key: "D", text: "An automated trading bot" },
        ],
        correctOption: "A",
        explanation: "Multi-sig wallets ensure no single individual can unilaterally move community funds.",
      },
      {
        questionNumber: 4,
        questionText: "Why is transparency critical for collective creator funding?",
        options: [
          { key: "A", text: "It builds trust and allows all stakeholders to audit treasury health" },
          { key: "B", text: "It increases transaction gas fees" },
          { key: "C", text: "It hides donor names" },
          { key: "D", text: "It prevents smart contracts from executing" },
        ],
        correctOption: "A",
        explanation: "Transparency eliminates backroom allocations and enables accountability.",
      },
      {
        questionNumber: 5,
        questionText: "What credential is unlocked by completing Collective Capital for Creators?",
        options: [
          { key: "A", text: "The Si Her DeFi Cohort 01 On-Chain Certificate on Base" },
          { key: "B", text: "A centralized driver's license" },
          { key: "C", text: "A physical plastic card" },
          { key: "D", text: "None" },
        ],
        correctOption: "A",
        explanation: "Completing this foundational task unlocks your verifiable certificate.",
      },
    ],
  });

  console.log("✅ Quizzes created.");

  // 3. Create Partners
  await Partner.create([
    {
      tag: "FOUNDATION",
      title: "DeFi for Good Foundation",
      description: "Hands-on intro: how self-deploy funds flow in emerging markets.",
      actionText: "Visit partner site ↗",
      actionUrl: "https://defiforgood.org",
      footerText: "Verified partner",
      order: 1,
    },
    {
      tag: "OCT 12 - NOV 01",
      title: "Tangem",
      description: "A hardware wallet for ease of a bank card — for everyday users with a broader audience.",
      actionText: "Visit partner site ↗",
      actionUrl: "https://tangem.com",
      footerText: "Includes quiz · Enter physical giveaway draw",
      order: 2,
    },
    {
      tag: "PARTNER",
      title: "KAST",
      description: "Spend cryptocurrency anywhere card payments are accepted with ease.",
      actionText: "Visit partner site ↗",
      actionUrl: "https://kast.money",
      footerText: "Includes quiz · Spend and receive cashback",
      order: 3,
    },
    {
      tag: "COMMUNITY",
      title: "Si Her Fund",
      description: "From and built for the ground up by this community.",
      actionText: "Get involved ↗",
      actionUrl: "https://siherdefi.org/fund",
      footerText: "Community governed",
      order: 4,
    },
  ]);

  console.log("✅ Partners created.");

  // 4. Create Demo User
  const demoEmail = "amara@siherdefi.org";
  let demoUser = await User.findOne({ email: demoEmail });
  if (!demoUser) {
    demoUser = await User.create({
      email: demoEmail,
      role: "member",
      walletAddress: "0x7a4f912c3b88e154672e0a6d59b2075fc94ac2b9",
      isEmailVerified: true,
      lastLoginAt: new Date(),
    });
  }

  // Demo Profile
  await Profile.findOneAndUpdate(
    { user: demoUser._id },
    {
      user: demoUser._id,
      name: "Amara Rodrigues",
      role: "Product Lead",
      organization: "Ecosystem Builder",
      socialLink: "https://linkedin.com/in/amara-rodrigues",
      bio: "Building payment rails for small merchants. Here to understand stablecoins properly before I ship anything on-chain.",
      photoUrl: "/ada-portrait.jpg",
      prefilledFields: ["name", "role", "organization"],
    },
    { upsert: true }
  );

  // Demo Progress
  await UserProgress.findOneAndUpdate(
    { user: demoUser._id },
    {
      user: demoUser._id,
      completedModules: [module1._id],
      hasPassedPrerequisiteForCertificate: true,
      earnedBadges: [
        {
          badgeId: "badge_collective-capital-for-creators",
          name: "Collective Capital Badge",
          image: "/Badge_earned.png",
          earnedAt: new Date(),
          sourceModuleId: module1._id as mongoose.Types.ObjectId,
        },
      ],
    },
    { upsert: true }
  );

  // Demo Certificate (Unlocked)
  await Certificate.findOneAndUpdate(
    { user: demoUser._id },
    {
      user: demoUser._id,
      recipientName: "Amara Rodrigues",
      recipientAddress: "0x7a4f912c3b88e154672e0a6d59b2075fc94ac2b9",
      status: "unlocked",
      cohortName: "Cohort 01 — Si Her DeFi",
      cohortDateRange: "Sep 24 – Dec 3 2026",
      network: "Base Mainnet",
      chainId: 8453,
      earnedBadgesCount: 1,
      totalBadgesCount: 12,
      verificationCode: "CERT-DEMO-0145",
    },
    { upsert: true }
  );

  // Demo Settings
  await Settings.findOneAndUpdate(
    { user: demoUser._id },
    {
      user: demoUser._id,
      emailNotifications: true,
      onChainVerificationPrivacy: true,
    },
    { upsert: true }
  );

  console.log("✅ Demo user Amara Rodrigues created/updated with unlocked certificate!");
  console.log("🎉 Seeding completed successfully.");

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
