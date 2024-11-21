import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
   name: { type: String, required: true },
   usn: { type: String, required: true },
   phone: { type: String, required: true, unique: true },
   college: { type: String, required: true },
   registrations: [{
      event_id: { type: mongoose.Schema.Types.ObjectId, required: false },
      ticket_url: { type: String, default: null},
      amount: { type: Number, required: false },
      order_id: { type: String, default: null },
      payment_status: { type: String, default: null },
      razorpay_payment_id: { type: String, default: null },
      registration_date: { type: Date, default: Date.now },
   }]
}, {
   timestamps: true, // Adds createdAt and updatedAt fields
   versionKey: false // Removes the __v field
});

// Export the model
const Participant = mongoose.models.Participant || mongoose.model('participant', ParticipantSchema);
export default Participant;
