import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { ProfileController } from "./profile.controller";
import { updateProfileSchema } from "./profile.validation";

const router = Router();

router.use(authenticateJwt);

router.get("/", ProfileController.getProfile);
router.put("/", validateRequest({ body: updateProfileSchema }), ProfileController.updateProfile);
router.get("/prefill", ProfileController.getPrefill);

export const profileRoutes = router;
