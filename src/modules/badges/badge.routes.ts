import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { BadgeController } from "./badge.controller";

const router = Router();

router.use(authenticateJwt);

router.get("/", BadgeController.getBadges);

export const badgeRoutes = router;
