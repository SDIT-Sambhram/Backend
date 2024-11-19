import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL, {
            useUnifiedTopology: true, // Enables connection pooling and monitoring
            maxPoolSize: 20, // Set the maximum number of connections in the pool
            serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds if server is unavailable
            socketTimeoutMS: 45000, // Timeout for inactivity on a connection (45 seconds)
        });

        console.log(`Connected to MongoDB: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`Error in connecting MongoDB: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;
