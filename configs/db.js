import mongoose from "mongoose";
import colors from "colors";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(`Connected to MongoDB ${conn.connection.host}`.bgMagenta.white);
        return conn;
    } catch (error) {
        console.error(`Error in connecting MongoDB: ${error}`.bgRed.white);
        process.exit(1); // Exit process with failure
    }
}

export default connectDB;