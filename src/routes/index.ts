import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { badgeRoutes } from "../modules/badges/badge.routes";
import { calendarRoutes } from "../modules/calendar/calendar.routes";
import { certificateRoutes } from "../modules/certificate/certificate.routes";
import { moduleRoutes } from "../modules/modules/module.routes";
import { onboardRoutes } from "../modules/onboard/onboard.routes";
import { partnerRoutes } from "../modules/partners/partner.routes";
import { profileRoutes } from "../modules/profile/profile.routes";
import { quizRoutes } from "../modules/quiz/quiz.routes";
import { settingsRoutes } from "../modules/settings/settings.routes";
import { walletRoutes } from "../modules/wallet/wallet.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/wallet", walletRoutes);
router.use("/onboard", onboardRoutes);
router.use("/modules", moduleRoutes);
router.use("/calendar", calendarRoutes);
router.use("/quiz", quizRoutes);
router.use("/badges", badgeRoutes);
router.use("/certificate", certificateRoutes);
router.use("/settings", settingsRoutes);
router.use("/partners", partnerRoutes);

export const v1Router = router;

