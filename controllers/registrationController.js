import Participant from "../models/Participant.js";
import { createOrder } from "../controllers/paymentController.js";
import { validateInputs } from "../helpers/validation.js";
import { validationResult } from "express-validator";
import he from "he"; // Decode the college name

const MAX_EVENTS = 4;

// Check if user can register based on their previous registrations
const canRegisterForEvents = async (phone, registrations) => {
    // Find the participant by phone
    const existingParticipant = await Participant.findOne(
        { phone },
        { 'registrations.event_id': 1, 'registrations.payment_status': 1 }
    );

    if (!existingParticipant) return { canRegister: true };

    // Filter out failed or null payment registrations
    const activeRegistrations = existingParticipant.registrations.filter(
        reg => reg.payment_status !== 'failed' && reg.payment_status !== null
    );

    if (activeRegistrations.length >= MAX_EVENTS) {
        return { canRegister: false, message: `User can register for up to ${MAX_EVENTS} unique events` };
    }

    const existingEventIds = new Set(activeRegistrations.map(reg => reg.event_id.toString()));

    // Check if the user is already registered for one of the requested events
    for (const reg of registrations) {
        if (existingEventIds.has(reg.event_id.toString())) {
            return { canRegister: false, message: 'User has already registered for one or more of these events' };
        }
    }

    return { canRegister: true };
};

export const registerParticipant = [
    // Step 1: Validate user input
    validateInputs,

    // Main registration logic
    async (req, res) => {
        try {
            // Step 1: Validate user input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, usn, college, phone, registrations } = req.body;

            // Step 2: Check if the user can register
            const { canRegister, message } = await canRegisterForEvents(phone, registrations);
            if (!canRegister) {
                return res.status(400).json({ message });
            }

            // Decode the college name to prevent encoding issues
            const decodedCollege = he.decode(college);

            // Step 3: Create Razorpay order
            const order = await createOrder(phone, registrations, usn, name, decodedCollege);
            if (!order) {
                return res.status(500).json({
                    message: 'Failed to create payment order with Razorpay',
                });
            }

            // Step 4: Send order details to the frontend
            return res.status(201).json({
                success: true,
                message: 'Successfully Created order id',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
            });

        } catch (error) {
            console.error('Error during registration:', error.stack || error.message);

            // Better error handling: Provide clear messages for different errors
            if (error.message.includes('Failed to create payment order')) {
                return res.status(500).json({ message: error.message });
            }

            if (error.message.includes('User can register for up to')) {
                return res.status(400).json({ message: error.message });
            }

            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
            });
        }
    }
];
