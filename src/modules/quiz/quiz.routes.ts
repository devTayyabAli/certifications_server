import { Router } from "express";
import { authenticateJwt } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validate.middleware";
import { QuizController } from "./quiz.controller";
import { answerQuestionSchema } from "./quiz.validation";

const router = Router();

router.use(authenticateJwt);

router.get("/:moduleId", QuizController.getQuiz);
router.post("/:moduleId/answer", validateRequest({ body: answerQuestionSchema }), QuizController.answer);
router.post("/:moduleId/restart", QuizController.restart);
router.post("/:moduleId/skip", QuizController.skip);

export const quizRoutes = router;
