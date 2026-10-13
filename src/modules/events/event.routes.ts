import { Router } from "express";
import { EventController } from "./event.controller";

const router = Router();

router.get("/", EventController.getEvents);

export const eventRoutes = router;
