import mongoose from "mongoose";

let isConnected = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let listenersRegistered = false;

mongoose.set("bufferCommands", false);

export const connectDatabase = async (mongoUri: string): Promise<void> => {
  const attemptConnection = async (): Promise<void> => {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 4000,
        maxPoolSize: 20
      });

      isConnected = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      console.info("MongoDB connected.");
    } catch (error) {
      isConnected = false;
      console.error("MongoDB unavailable. Retrying in 5 seconds.");

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void attemptConnection();
        }, 5000);
        reconnectTimer.unref();
      }
    }
  };

  if (!listenersRegistered) {
    listenersRegistered = true;

    mongoose.connection.on("connected", () => {
      isConnected = true;
    });

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void attemptConnection();
        }, 5000);
        reconnectTimer.unref();
      }
      console.error("MongoDB disconnected.");
    });

    mongoose.connection.on("error", () => {
      isConnected = false;
      console.error("MongoDB connection error.");
    });
  }

  await attemptConnection();
};

export const isDatabaseConnected = (): boolean => isConnected;
