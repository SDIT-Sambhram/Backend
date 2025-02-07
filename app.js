import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./configs/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// Config dotenv
dotenv.config();

// Database config
connectDB();


// Initialize express app
const app = express();

// Middleware setup
app.use(express.json()); // Middleware for parsing JSON data
app.use(morgan("dev"));   // Logging middleware
app.set('trust proxy', true);

// Routes
app.use("/api/v1/auth", authRoutes);
app.use('/api/admin', adminRoutes);





// Root endpoint
app.get("/", (request, response) => {
    response.send("Server is up and running");
});


app.listen(PORT, () => {
    console.log(`Server Running on ${PORT}`);
})

export default app;
