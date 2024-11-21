import mongoose from "mongoose";
import logger from "../utils/logger.js"; // Assuming you have a logger utility

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

const connectWithRetry = async (retryCount = 0) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000, // Connection timeout
      heartbeatFrequencyMS: 30000, // How often to send heartbeat
      retryWrites: true,
      retryReads: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying connection... Attempt ${retryCount + 1}/${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry(retryCount + 1);
    }

    logger.error('Failed to connect to MongoDB after maximum retries');
    process.exit(1);
  }
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    logger.info('MongoDB is already connected');
    return mongoose.connection;
  }

  if (!process.env.MONGO_URL) {
    logger.error('MONGO_URL environment variable is not defined');
    process.exit(1);
  }

  return connectWithRetry();
};

export default connectDB;