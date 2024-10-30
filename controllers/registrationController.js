import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { createOrder } from "../controllers/paymentController.js";
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

// Controller to handle registration requests
export const createRegistration = [
    // registrationLimiter, // Middleware to limit registration requests
    // validateInputs, // Middleware to validate input data
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
            // Check if participant already exists
            const { phone, registrations, amount } = req.body;
            const participant = await Participant.findOne({ phone });

            if (participant) {
                // Check if participant can register for the new events
                const { canRegister, message } = canRegisterForEvents(participant, registrations);
                if (!canRegister) return res.status(400).json({ message });
            } else if (registrations.length > MAX_EVENTS) {
                return res.status(400).json({ message: `User can register for up to ${MAX_EVENTS} unique events` });
            }

            // Create a new order for the registration
            const order = await createOrder(amount);
            if (!order) return res.status(500).json({ message: 'Order creation failed' });

            // Respond with order details
            res.status(200).json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, key: order.key });
        } catch (error) {
            console.error('Error during registration:', error);
            next(error);
        }
    }
];

// Controller to verify and register participant after payment
export const registerParticipant = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { name, usn, phone, college, registrations } = req.body;

        // Validate required fields
        if (!name || !usn || !phone || !college || !registrations || registrations.length === 0) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if participant already exists
        let participant = await Participant.findOne({ phone }).session(session);
        const isNewParticipant = !participant;

        // Prepare new registrations
        const newRegistrations = registrations.map(reg => ({
            event_id: reg.event_id,
            qr_code: 'pending',
            payment_status: 'pending',
            order_id: reg.order_id,
            registration_date: new Date()
        }));

        if (isNewParticipant) {
            // Create a new participant
            participant = new Participant({ name, usn, phone, college, registrations: newRegistrations });
        } else {
            // Check if participant can register for the new events
            const { canRegister, message } = canRegisterForEvents(participant, newRegistrations);
            if (!canRegister) return res.status(400).json({ message });
            participant.registrations.push(...newRegistrations);
        }

        // Save participant data in the session
        await participant.save({ session });
        await session.commitTransaction();

        // Respond with success message and participant details
        res.status(201).json({
            success: true,
            message: 'User registered successfully, awaiting payment confirmation',
            participant: {
                _id: participant._id,
                name: participant.name,
                usn: participant.usn,
                phone: participant.phone,
                college: participant.college,
                registrations: participant.registrations
            }
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error during registration:', error);
        next(error);
    } finally {
        session.endSession();
    }
};