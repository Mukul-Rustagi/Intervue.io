import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { Server } from "socket.io";

import { createApp } from "./app.js";
import { connectDatabase, isDatabaseConnected } from "./config/database.js";
import { env } from "./config/env.js";
import { PollController } from "./controllers/PollController.js";
import { ChatMessageModel } from "./models/ChatMessage.js";
import { PollModel } from "./models/Poll.js";
import { VoteModel } from "./models/Vote.js";
import { ChatService } from "./services/ChatService.js";
import { ModerationService } from "./services/ModerationService.js";
import { PollService } from "./services/PollService.js";
import { StudentRegistryService } from "./services/StudentRegistryService.js";
import { PollSocketHandler } from "./sockets/PollSocketHandler.js";

const bootstrap = async (): Promise<void> => {
  const studentRegistry = new StudentRegistryService();
  const pollService = new PollService(studentRegistry, env.MAX_POLL_DURATION_SECONDS);
  const chatService = new ChatService();
  const moderationService = new ModerationService(studentRegistry);

  const pollController = new PollController(pollService, chatService);
  const app = createApp(pollController);
  const server = createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true
    }
  });

  const socketHandler = new PollSocketHandler(
    io,
    pollService,
    chatService,
    studentRegistry,
    moderationService
  );
  socketHandler.register();

  await connectDatabase(env.MONGODB_URI);
  if (isDatabaseConnected()) {
    try {
      await Promise.all([
        PollModel.syncIndexes(),
        VoteModel.syncIndexes(),
        ChatMessageModel.syncIndexes()
      ]);
    } catch (error) {
      console.error("Failed to sync MongoDB indexes.", error);
    }
  }
  await pollService.bootstrap();

  server.on("error", (error) => {
    if ("code" in error && error.code === "EADDRINUSE") {
      console.error(`Port ${env.PORT} is already in use. Update PORT in backend/.env and restart.`);
      process.exit(1);
    }

    console.error("HTTP server failed to start.", error);
    process.exit(1);
  });

  server.listen(env.PORT, env.HOST, () => {
    const address = server.address() as AddressInfo | null;
    if (!address) {
      console.info(`Backend running on port ${env.PORT}`);
      return;
    }

    console.info(`Backend running on http://${address.address}:${address.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

void bootstrap();
