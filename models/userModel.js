import mongoose from "mongoose";

const CulturalEventSchema = new mongoose.Schema({
    name: { type: String, required: true },                                // Name of the cultural event
    is_team_event: { type: Boolean, required: true },                      // True for team events, false for individual events
    team_size_limit: { type: Number, default: 0 },                        // Maximum number of members allowed in a team
    description: { type: String, required: true },                        // Description of the event
    event_date: { type: Date, required: true }                            // Date of the event
});

const TechnicalEventSchema = new mongoose.Schema({
    name: { type: String, required: true },                                // Name of the technical event
    is_team_event: { type: Boolean, required: true },                      // True for team events, false for individual events
    team_size_limit: { type: Number, default: 0 },                        // Maximum number of members allowed in a team
    description: { type: String, required: true },                        // Description of the event
    event_date: { type: Date, required: true }                            // Date of the event
});

const SpecialEventSchema = new mongoose.Schema({
    name: { type: String, required: true },                                // Name of the special event
    is_team_event: { type: Boolean, required: true },                      // True for team events, false for individual events
    team_size_limit: { type: Number, default: 0 },                        // Maximum number of members allowed in a team
    description: { type: String, required: true },                        // Description of the event
    event_date: { type: Date, required: true }                            // Date of the event
});

// Create the SpecialEvent model
const SpecialEvent = mongoose.model('SpecialEvent', SpecialEventSchema);


// Create the TechnicalEvent model
const TechnicalEvent = mongoose.model('TechnicalEvent', TechnicalEventSchema);


// Create the CulturalEvent model
const CulturalEvent = mongoose.model('CulturalEvent', CulturalEventSchema);



//partcipent schema
const ParticipantSchema = new mongoose.Schema({
    name: { type: String, required: true },                               // Name of the participant
    usn: { type: String, required: true },                               // Unique Student Number
    phone: { type: String, required: true, unique: true },              // Unique phone number
    college: { type: String, required: true },                           // College name
    registrations: [{                                                      // Array of event registrations
        event_id: { type: mongoose.Schema.Types.ObjectId, required: true },  // Reference to the event (could be Cultural, Technical, or Special)
        is_team_event: { type: Boolean, required: true },                // True for team events, false for individual events
        team_members: { type: [String], default: [] },                  // Array to store team member names for team events
        qr_code: { type: String, required: true },                      // Generated QR code for this registration
        payment_status: { type: String, enum: ['paid', 'pending', 'failed'], required: true }, // Status of the payment
        razorpay_payment_id: { type: String, required: true },          // Payment ID from Razorpay
        registration_date: { type: Date, default: Date.now }            // Timestamp for registration
    }]
});

// Create the Participant model
const Participant = mongoose.model('Participant', ParticipantSchema);



//payment schema
const PaymentSchema = new mongoose.Schema({
    participant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true }, // Reference to the Participant model
    event_id: { type: mongoose.Schema.Types.ObjectId, required: true },                            // Reference to the Event model
    razorpay_payment_id: { type: String, required: true },                                      // Razorpay payment ID
    amount: { type: Number, required: true },                                                  // Payment amount
    status: { type: String, enum: ['paid', 'pending', 'failed'], required: true },              // Status of the payment
    date: { type: Date, default: Date.now }                                                    // Timestamp for payment
});

// Create the Payment model
const Payment = mongoose.model('Payment', PaymentSchema);

export default { ParticipantSchema, SpecialEventSchema, TechnicalEventSchema, CulturalEventSchema, PaymentSchema }