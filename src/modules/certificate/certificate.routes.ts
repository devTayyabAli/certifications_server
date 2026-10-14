import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { publicLookupRateLimiter } from "../../middlewares/rate-limiter.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { CertificateController } from "./certificate.controller";
import { recordClaimSchema } from "./certificate.validation";

const router: Router = Router();

// Public verification route (no auth required), rate-limited against code guessing
router.get("/verify/:identifier", publicLookupRateLimiter, CertificateController.verifyPublic);

// Protected routes
router.use(authenticateJwt);
router.get("/", CertificateController.getCertificate);
// Learners claim their own badges: the server signs a voucher, the learner's
// wallet sends claim(), and the reported transaction is verified on-chain
router.post("/claim", CertificateController.claimVoucher);
router.post("/claim/submitted", validateRequest({ body: recordClaimSchema }), CertificateController.recordClaim);

export const certificateRoutes = router;
