import { Router } from "express";

import { PollController } from "../controllers/PollController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const createPollRouter = (controller: PollController): Router => {
  const router = Router();

  router.get("/state", asyncHandler(controller.getState));
  router.get("/polls/history", asyncHandler(controller.getHistory));
  router.post("/polls", asyncHandler(controller.createPoll));
  router.post("/polls/:pollId/votes", asyncHandler(controller.submitVote));

  return router;
};
