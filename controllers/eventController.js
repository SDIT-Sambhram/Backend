import mongoose from "mongoose";
import Event from '../models/eventModel.js';
import connectDB from '../configs/db.js';

// Function to retrieve all event details
const getAllEventDetails = async (req, res) => {
    try {
        // Fetch all events
        const events = await Event.find().lean();  // `lean()` for faster read-only operations
        console.log("Events retrieved successfully:", events);

        res.status(200).send(events)// Send the events as JSON response
        
        return events;  // Return the events if needed for further use
    } catch (error) {
        console.error("Error retrieving event details:", error);
    }

};

export default getAllEventDetails;