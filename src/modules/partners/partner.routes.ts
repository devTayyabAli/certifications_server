import { Router } from "express";
import { PartnerController } from "./partner.controller";

const router = Router();

router.get("/", PartnerController.getPartners);
router.get("/more-ways", PartnerController.getMoreWays);

export const partnerRoutes = router;
