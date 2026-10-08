import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { SettingsController } from "./settings.controller";
import { updateSettingsSchema } from "./settings.validation";

const router = Router();

router.use(authenticateJwt);

router.get("/", SettingsController.getSettings);
router.patch("/", validateRequest({ body: updateSettingsSchema }), SettingsController.updateSettings);

export const settingsRoutes = router;
