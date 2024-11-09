import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./configs/db.js";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import serverless from "serverless-http"; // Import serverless-http

// Config dotenv
dotenv.config();

// Database config
connectDB();

// Initialize express app
const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/v1/auth', authRoutes);

// Root endpoint
app.get('/', (request, response) => {
    response.send("Welcome to our medical shop");
});

// Export the app as a Lambda-compatible handler
export const handler = serverless(app);

