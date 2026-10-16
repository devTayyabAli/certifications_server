import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { CalendarController } from "./calendar.controller";

const router: Router = Router();

// Public ICS file downloads & calendar link generation
router.get("/session/:sessionId", CalendarController.downloadSessionIcs);
router.get("/session/:sessionId/ics", CalendarController.downloadSessionIcs);
router.get("/session/:sessionId/links", CalendarController.getSessionCalendarLinks);
router.get("/:id/ics", CalendarController.downloadIcs);
// A learner's private subscription feed: the signed token in the URL stands in for sign-in
router.get("/feed/:file", CalendarController.getFeed);

// Everything below needs a signed-in learner. Reminder emails used to be
// public, which let anyone use the server to email any address.
router.use(authenticateJwt);

// Reminder email — only ever to the signed-in learner's own address
router.post("/session/:sessionId/reminder", CalendarController.sendSessionReminder);
router.post("/reminder", CalendarController.sendSessionReminder);

// The learner's own subscribe links
router.get("/feed-link", CalendarController.getFeedLink);

// User schedule routes
router.get("/my-schedule", CalendarController.getMySchedule);
router.post("/schedule", CalendarController.scheduleSession);
router.post("/unschedule", CalendarController.unscheduleSession);

export const calendarRoutes = router;
