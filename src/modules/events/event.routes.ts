import { Router } from "express";
import { EventController } from "./event.controller";

const router: Router = Router();

router.get("/", EventController.getEvents);

export const eventRoutes: Router = router;
