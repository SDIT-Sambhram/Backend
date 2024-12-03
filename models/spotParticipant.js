import mongoose from 'mongoose';

const spotParticipantSchema = new mongoose.Schema({
   name: { type: String, required: true },
   usn: { type: String, required: true },
   phone: { type: String, required: true, unique: true },
   college: { type: String, required: true },
   amount: { type: Number, required: false },
   registrations: [{
      event_id: { type: mongoose.Schema.Types.ObjectId, required: false },
      registration_date: { type: Date, default: Date.now },
   }]
}, {
   timestamps: true, // Adds createdAt and updatedAt fields
   versionKey: false // 
});

// Export the model
const spotParticipant = mongoose.models.spotParticipant || mongoose.model('spotParticipant', spotParticipantSchema);
export default spotParticipant;
