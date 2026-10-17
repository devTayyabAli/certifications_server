import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { ModuleController } from "./module.controller";

const router: Router = Router();

// Public calendar & speaker endpoints
router.get("/cms/speakers", ModuleController.getCmsSpeakers);
router.get("/:id/calendar/ics", ModuleController.downloadIcs);
router.get("/:id/calendar-link", ModuleController.getCalendarLinks);

router.use(authenticateJwt);

router.get("/", ModuleController.getAll);
router.get("/:id", ModuleController.getOne);
// No "complete" endpoint on purpose: a module is completed only by passing its quiz
router.post("/:id/schedule", ModuleController.schedule);
router.post("/:id/invite", ModuleController.invite);
router.delete("/:id/schedule", ModuleController.unschedule);

export const moduleRoutes = router;

