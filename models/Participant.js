import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
   name: { type: String, required: true },
   usn: { type: String, required: true },
   phone: { type: String, required: true, unique: true },
   college: { type: String, required: true },
   registrations: [{
      event_id: { type: mongoose.Schema.Types.ObjectId, required: true },
      qr_code: { type: String },
      payment_status: { type: String, enum: ['paid', 'pending', 'failed'], required: true },
      razorpay_payment_id: { type: String, required: true },
      registration_date: { type: Date, default: Date.now },
   }]
}, {
   timestamps: true, // Adds createdAt and updatedAt fields
   versionKey: false // Removes the __v field
});

// Export the model
const Participant = mongoose.models.Participant || mongoose.model('Participant', ParticipantSchema);
export default Participant;
