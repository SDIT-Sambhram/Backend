import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
   name: { type: String, required: true },
   usn: { type: String, required: true },
   phone: { type: String, required: true, unique: true },
   college: { type: String, required: true },
   registrations: [{
      event_id: { type: mongoose.Schema.Types.ObjectId, required: true },
      is_team_event: { type: Boolean, required: true },
      team_members: { type: [String], default: [] },
      qr_code: { type: String, required: true },
      payment_status: { type: String, enum: ['paid', 'pending', 'failed'], required: true },
      razorpay_payment_id: { type: String, required: true },
      registration_date: { type: Date, default: Date.now }
   }]
});

// Export the model
const Participant = mongoose.model.Participant||mongoose.model('Participant', ParticipantSchema);
export default Participant;  // Use default export
