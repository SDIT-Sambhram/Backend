import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(`Connected to MongoDB`);
        return conn;
    } catch (error) {
        console.error(`Error in connecting MongoDB:`);
        process.exit(1); // Exit process with failure
    }
}

export default connectDB;