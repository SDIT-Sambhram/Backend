import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./configs/db.js";
import authRoutes from "./routes/authRoutes.js";
import serverless from "serverless-http"; // Import serverless-http

// Config dotenv
dotenv.config();

// Database config
connectDB();

// Initialize express app
const app = express();

// Middleware setup
app.use(express.json()); // Middleware for parsing JSON data
app.use(morgan("dev"));   // Logging middleware

// Routes
app.use("/api/v1/auth", authRoutes);

<<<<<<< HEAD
//rest api
app.get('/', (request, response) => {
    response.send("Welcome to our Sambhram")
})

//port

const PORT = process.env.PORT || 8081;
1
app.listen(PORT, '0.0.0.0',() => {
    console.log(`Server Running on ${PORT}`.bgCyan.white);
})
=======
// Root endpoint
app.get("/", (request, response) => {
    response.send("Server is up and running");
});

// Export the app as a Lambda-compatible handler
export const handler = serverless(app);
>>>>>>> 397c6cb06723b7f1df7677d88c65d90bc8316741
