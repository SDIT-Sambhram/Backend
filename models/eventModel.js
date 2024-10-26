import mongoose from "mongoose";

// Unified Event Schema
const EventSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true  // Automatically trims whitespace
    },  // Name of the event
    category: { 
        type: String, 
        enum: ['Cultural', 'Technical', 'Special'], 
        required: true 
    },  // Category of the event
    event_type: { 
        type: String, 
        enum: ['team', 'individual'], 
        required: true 
    },  // Event type: "team" or "individual"
    description: { 
        type: String, 
        required: true,
        trim: true  // Automatically trims whitespace
    },  // Description of the event
    event_date: { 
        type: Date, 
        required: true 
    },  // Date of the event
    venue: { 
        type: String, 
        required: true,
        trim: true  // Automatically trims whitespace
    },  // Venue of the event
    price: { 
        type: Number, 
        required: true,
        min: 0      // Ensures price cannot be negative
    }   // Price of the event
}, { timestamps: true });  // Automatically manage createdAt and updatedAt timestamps

// Create the Event model
const Event = mongoose.model('Event', EventSchema);

export default { Event };
