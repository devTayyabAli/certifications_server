import { Request, Response } from "express";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { QuizService } from "./quiz.service";

export class QuizController {
  static getQuiz = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { moduleId } = req.params;
    const quiz = await QuizService.getQuizByModule(moduleId, userId);
    return ApiResponse.success(res, {
      message: "Quiz retrieved successfully",
      data: quiz,
    });
  });

  static answer = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { moduleId } = req.params;
    const result = await QuizService.answerQuestion(moduleId, userId, req.body);
    return ApiResponse.success(res, {
      message: result.result?.passed ? "Quiz passed — badge earned" : "Answer recorded",
      data: result,
    });
  });
}
