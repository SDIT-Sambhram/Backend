import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { createOrder } from "../controllers/paymentController.js";
import registrationLimiter from '../middlewares/rateLimiter.js';
import { validateInputs } from '../helpers/validation.js';

const MAX_EVENTS = 4;

// Helper function to check event registration limits
const canRegisterForEvents = (participant, newRegistrations) => {
    // Get unique event IDs from existing registrations, excluding failed payments
    const existingEventIds = new Set(
        participant.registrations
            .filter(reg => reg.payment_status !== 'failed')
            .map(reg => reg.event_id.toString())
    );

    const totalRegisteredEvents = existingEventIds.size;

    // Check if the participant has reached the max events limit
    if (totalRegisteredEvents >= MAX_EVENTS) {
        return { canRegister: false, message: `User can register for up to ${MAX_EVENTS} unique events` };
    }

    // Identify any conflicting event IDs with new registrations
    const conflictingEventIds = newRegistrations
        .map(reg => reg.event_id.toString())
        .filter(eventId => existingEventIds.has(eventId));

    if (conflictingEventIds.length > 0) {
        return { canRegister: false, message: `User has already registered for the following events: ${conflictingEventIds.join(', ')}` };
    }

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

            const { name, usn, college, phone, amount, registrations } = req.body;

            // Validate required fields
            if (!name || !usn || !phone || !college || !registrations || registrations.length === 0) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            // Check if participant already exists
            let participant = await Participant.findOne({ phone }).session(session);
            const isNewParticipant = !participant;

            // Create a new order for the registration
            const order = await createOrder(amount, phone);
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
            await session.commitTransaction();

            // Respond with success message and order details
            res.status(201).send({
                success: true,
                message: 'User registered successfully, awaiting payment confirmation',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
            });

        } catch (error) {
            // Check if the session is in a transaction before aborting
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            console.error('Error during registration:', error);
            res.status(500).json({ message: 'Internal Server Error', error: error.message });
        } finally {
            session.endSession();
        }
    }
];
