import Participant from "../models/Participant.js";
import { createOrder } from "../controllers/paymentController.js";
import { validateInputs } from "../helpers/validation.js";
import { validationResult } from "express-validator";
import he from "he"; // Decode the college name
import logger from "../utils/logger.js"; // Import logger
import registrationLimiter from "../middlewares/rateLimiter.js";

const MAX_EVENTS = 4;

// Check if user can register based on their previous registrations
const canRegisterForEvents = async (phone, newRegistrations) => {
    const existingParticipant = await Participant.findOne(
        { phone },
        { 'registrations.event_id': 1, 'registrations.payment_status': 1 }  
    );

    if (!existingParticipant) return { canRegister: true };

    // Filter active registrations (paid or in-process)
    const activeRegistrations = existingParticipant.registrations.filter(
        reg => reg.payment_status !== 'failed' && reg.payment_status !== null
    );

    // Combine existing and new unique event IDs
    const existingEventIds = new Set(activeRegistrations.map(reg => reg.event_id.toString()));
    const newEventIds = new Set(newRegistrations.map(reg => reg.event_id.toString()));

    // Total unique events after combining
    const totalUniqueEvents = new Set([...existingEventIds, ...newEventIds]);

    // Check total unique events against max limit
    if (totalUniqueEvents.size > MAX_EVENTS) {
        logger.warn(`User with phone ${phone} would exceed the maximum event registration limit.`);
        return { 
            canRegister: false, 
            message: `User can register for up to ${MAX_EVENTS} unique events` 
        };
    }

    // Check for duplicate events in new registrations
    const duplicateNewEvents = newRegistrations.some(reg => 
        existingEventIds.has(reg.event_id.toString())
    );

    if (duplicateNewEvents) {
        logger.warn(`User with phone ${phone} has already registered for one or more of these events`);
        return { 
            canRegister: false, 
            message: 'User has already registered for one or more of these events' 
        };
    }

    return { canRegister: true };
};

export const registerParticipant = [
    // Step 1: Validate user input
    validateInputs,
    // registrationLimiter,

    // Main registration logic
    async (req, res) => {
        try {
            // Step 1: Validate user input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.error('Validation errors:', errors.array());
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, usn, college, phone, registrations } = req.body;
            logger.info(`Received registration request for phone: ${phone}, events: ${registrations.length}`);

            // Step 2: Check if the user can register
            const { canRegister, message } = await canRegisterForEvents(phone, registrations);
            if (!canRegister) {
                logger.warn(`Registration failed for phone ${phone}: ${message}`);
                return res.status(400).json({ message });
            }

            // Decode the college name to prevent encoding issues
            const decodedCollege = he.decode(college);
            logger.info(`Decoded college name: ${decodedCollege}`);

            // Step 3: Create Razorpay order
            const order = await createOrder(phone, registrations, usn, name, decodedCollege);
            if (!order) {
                logger.error(`Failed to create Razorpay order for phone: ${phone}`);
                return res.status(500).json({
                    message: 'Failed to create payment order with Razorpay',
                });
            }

            logger.info(`Razorpay order created successfully for phone: ${phone}, Order ID: ${order.id}`);

            // Step 4: Send order details to the frontend
            return res.status(201).json({
                success: true,
                message: 'Successfully Created order id',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
            });

        } catch (error) {
            logger.error('Error during registration:', { error: error.message, stack: error.stack });

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
