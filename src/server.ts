import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";

async function bootstrap() {
  console.log("🚀 Starting Si Her DeFi Backend Server...");

  // Connect to MongoDB
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🎉 Server listening on http://localhost:${env.PORT}`);
    console.log(`📡 Environment: ${env.NODE_ENV}`);
    console.log(`🔗 API Base: http://localhost:${env.PORT}/api/v1`);
    console.log(`🩺 Health:   http://localhost:${env.PORT}/health`);
    console.log(`======================================================\n`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log("🔒 HTTP server closed.");
      await disconnectDatabase();
      console.log("👋 Process terminated cleanly.");
      process.exit(0);
    });

    // Force shutdown after 10 seconds if not closed cleanly
    setTimeout(() => {
      console.error("⚠️ Forcing shutdown due to timeout.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("💥 Unhandled Rejection at:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught Exception:", error);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Fatal bootstrap error:", err);
  process.exit(1);
});
