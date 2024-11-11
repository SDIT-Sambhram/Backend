import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  eventType: { type: String, required: true }, // Cultural, Technical, or Special
  description: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true },
  studentCoordinator: { type: String, required: true },
  studentCoordinatorContact: { type: String, required: true },
  rules: { type: [String], required: true }  
});

const Event = mongoose.model('event', eventSchema);

export default Event;