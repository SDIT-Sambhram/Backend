import mongoose from "mongoose";
import Event from '../models/eventModel.js';
import connectDB from '../configs/db.js';

// Function to retrieve all event details
const getAllEventDetails = async (req, res) => {
    try {
        // Connect to the database
        await connectDB();

        // Fetch all events
        const events = await Event.find().lean();  // `lean()` for faster read-only operations

        console.log("All Event Details:", events);

        res.status(200).json(events)  // Send the events as JSON response
        
        return events;  // Return the events if needed for further use
    } catch (error) {
        console.error("Error retrieving event details:", error);
    } finally {
        // Close the connection when done
        mongoose.connection.close();
    }
};

export default getAllEventDetails;