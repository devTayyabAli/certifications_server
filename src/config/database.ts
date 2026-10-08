import dns from "dns";
import mongoose from "mongoose";
import { env } from "./env";

// Configure reliable DNS servers to avoid querySrv ECONNREFUSED on Windows/ISPs for MongoDB Atlas SRV
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Fallback gracefully
}

export async function connectDatabase(): Promise<void> {
  const uri = env.MONGODB_URI;

  mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB connected successfully to:", uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@"));
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected. Attempting reconnection...");
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error("❌ Initial MongoDB connection failed:", error);
    // In development mode, we continue running so other features and mocks can be inspected if DB is not up yet
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Serverless (Vercel): connect once per instance and reuse the connection
 * across requests. A failed attempt is forgotten so the next request retries,
 * instead of crashing the function.
 */
export async function ensureDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    connecting = mongoose
      .connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        // Small pool: each serverless instance handles a few requests at a time
        maxPoolSize: 5,
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  await connecting;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log("🛑 MongoDB disconnected gracefully.");
}
