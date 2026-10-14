import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { publicLookupRateLimiter } from "../../middlewares/rate-limiter.middleware";
import { CertificateController } from "./certificate.controller";

const router: Router = Router();

// Public verification route (no auth required), rate-limited against code guessing
router.get("/verify/:identifier", publicLookupRateLimiter, CertificateController.verifyPublic);

// Protected routes
router.use(authenticateJwt);
router.get("/", CertificateController.getCertificate);
// The server's minter wallet mints; nothing from the client (no hashes) is trusted
router.post("/mint", CertificateController.mint);

export const certificateRoutes = router;
