import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { publicLookupRateLimiter } from "../../middlewares/rate-limiter.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { CertificateController } from "./certificate.controller";
import { recordMintSchema } from "./certificate.validation";

const router = Router();

// Public verification route (no auth required), rate-limited against code guessing
router.get("/verify/:identifier", publicLookupRateLimiter, CertificateController.verifyPublic);

// Protected routes
router.use(authenticateJwt);
router.get("/", CertificateController.getCertificate);
router.post("/prepare-mint", CertificateController.prepareMint);
router.post("/record-mint", validateRequest({ body: recordMintSchema }), CertificateController.recordMint);

export const certificateRoutes = router;
