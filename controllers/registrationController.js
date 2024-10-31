import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { createOrder } from "../controllers/paymentController.js";
import { generateQRCode } from '../helpers/qrCodeGenerator.js'; // Import QR code generator
import registrationLimiter from '../middlewares/rateLimiter.js';
import { validateInputs } from '../helpers/validation.js';

const MAX_EVENTS = 4;

// Helper function to check event registration limits
const canRegisterForEvents = (participant, newRegistrations) => {
    const existingEventIds = new Set(participant.registrations.map(reg => reg.event_id.toString()));
    if (participant.registrations.length >= MAX_EVENTS) return { canRegister: false, message: `User can register for up to ${MAX_EVENTS} unique events` };
    const conflictingEventIds = newRegistrations.filter(reg => existingEventIds.has(reg.event_id.toString())).map(reg => reg.event_id.toString());
    if (conflictingEventIds.length > 0) return { canRegister: false, message: `User has already registered for the following events: ${conflictingEventIds.join(', ')}` };
    return { canRegister: true };
};

// Unified registration controller
export const registerParticipant = [
    // registrationLimiter, // Rate limiting middleware
    // validateInputs, // Input validation middleware
    async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            console.log('Request body:', req.body);

            const { name, usn, college, phone, amount,  registrations } = req.body;


            // Validate required fields
            if (!name || !usn || !phone || !college || !registrations || registrations.length === 0) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            // Check if participant already exists
            let participant = await Participant.findOne({ phone }).session(session);
            const isNewParticipant = !participant;

                        // Create a new order for the registration
            const order = await createOrder(amount);
            if (!order) throw new Error('Order creation failed');

            // Prepare new registrations
            const newRegistrations = registrations.map(reg => ({
                event_id: reg.event_id,
                order_id: order.id,
                amount,
                payment_status: 'pending',
                registration_date: new Date(),
            }));

            if (isNewParticipant) {
                // Create a new participant
                participant = new Participant({ name, usn, phone, college, qr_code: "pending", registrations: newRegistrations });
            } else {
                // Check if participant can register for the new events
                const { canRegister, message } = canRegisterForEvents(participant, newRegistrations);
                if (!canRegister) return res.status(400).json({ message });
                participant.registrations.push(...newRegistrations);
            }

            // Save participant data in the session
            await participant.save({ session });

            // Generate QR code for the participant after successful registration


            await session.commitTransaction();

            // Respond with success message and order details
            res.status(201).send({
                success: true,
                message: 'User registered successfully, awaiting payment confirmation',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                participant: {
                    _id: participant._id,
                    name: participant.name,
                    usn: participant.usn,
                    phone: participant.phone,
                    college: participant.college,
                    registrations: participant.registrations,
                    qr_code: participant.qr_code // Include the QR code in the response
                }
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Error during registration:', error);
            res.status(500).json({ message: 'Internal Server Error', error: error.message });
        } finally {
            session.endSession();
        }
    }
];
