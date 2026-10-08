import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { OnboardController } from "./onboard.controller";
import { part1DraftSchema, part1SubmitSchema, part2SurveySchema } from "./onboard.validation";

const router = Router();

router.use(authenticateJwt);

router.get("/status", OnboardController.getStatus);
router.get("/part1", OnboardController.getPart1);
router.put("/part1/draft", validateRequest({ body: part1DraftSchema }), OnboardController.saveDraft);
router.post("/part1", validateRequest({ body: part1SubmitSchema }), OnboardController.submitPart1);
router.post("/part2", validateRequest({ body: part2SurveySchema }), OnboardController.submitPart2);

export const onboardRoutes = router;
