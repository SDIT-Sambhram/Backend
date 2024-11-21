import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { createOrder } from "../controllers/paymentController.js";
import { validateInputs } from "../helpers/validation.js";
import { validationResult } from "express-validator";
import registrationLimiter from "../middlewares/rateLimiter.js";
import he from "he"; // Import the 'he' library

const MAX_EVENTS = 4;

// Retry utility with exponential backoff
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
    while (retries > 0) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 1) {
                console.warn(`Retrying after delay (${delay}ms)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                retries--;
            } else {
                throw error; // Exhausted retries
            }
        }
    }
};

// Check if user can register for new events
const canRegisterForEvents = (existingRegistrations, newRegistrations) => {
    const activeRegistrations = existingRegistrations.filter(
        reg => reg.payment_status !== 'failed' && reg.payment_status !== null
    );

    if (activeRegistrations.length >= MAX_EVENTS) {
        return { 
            canRegister: false, 
            message: `User can register for up to ${MAX_EVENTS} unique events` 
        };
    }

    const existingEventIds = new Set(activeRegistrations.map(reg => reg.event_id.toString()));

    for (const reg of newRegistrations) {
        if (existingEventIds.has(reg.event_id.toString())) {
            return { 
                canRegister: false, 
                message: 'User has already registered for one or more of these events' 
            };
        }
    }

    return { canRegister: true };
};

export const registerParticipant = [
    // Add validation middleware
    validateInputs,
    registrationLimiter,
    
    // Main registration logic
    async (req, res) => {
        let session;
        try {
            // Validate input errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, usn, college, phone, registrations } = req.body;

            // Decode the college name
            const decodedCollege = he.decode(college);

            // Retryable operation: Create Razorpay order
            const order = await retryWithBackoff(() => createOrder(phone, registrations), 3, 1000);

            if (!order) {
                throw new Error('Order creation failed');
            }

            console.log('Razorpay order created:', order.id);

            const newRegistrations = registrations.map(reg => ({
                event_id: reg.event_id,
                order_id: order.id,
                amount: (order.amount/100),
                registration_date: new Date()
            }));

            // Start MongoDB session
            session = await mongoose.startSession();
            session.startTransaction();

            // Fetch participant details
            const existingParticipant = await Participant.findOne(
                { phone },
                { 'registrations.event_id': 1, 'registrations.payment_status': 1 }
            ).session(session);

            let participantId;

            if (existingParticipant) {
                const { canRegister, message } = canRegisterForEvents(
                    existingParticipant.registrations, 
                    newRegistrations
                );

                if (!canRegister) {
                    await session.abortTransaction();
                    return res.status(400).json({ message });
                }

                // Update existing participant
                await Participant.updateOne(
                    { phone },
                    { $push: { registrations: { $each: newRegistrations } } },
                    { session }
                );

                participantId = existingParticipant._id;
                console.log('Updated existing participant:', participantId);

            } else {
                // Create new participant
                const newParticipant = await Participant.create([{
                    name,
                    usn,
                    phone,
                    college: decodedCollege, // Use the decoded college name
                    registrations: newRegistrations
                }], { session });

                participantId = newParticipant[0]._id;
                console.log('Created new participant:', participantId);
            }

            // Commit transaction
            await session.commitTransaction();
            console.log('Transaction committed successfully');

            return res.status(201).json({
                success: true,
                message: 'User registered successfully, awaiting payment confirmation',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                participantId,
            });

        } catch (error) {
            if (session?.inTransaction()) {
                await session.abortTransaction();
            }
            console.error('Error during registration:', error.stack || error.message);

            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message
            });
        } finally {
            if (session) {
                await session.endSession();
            }
        }
    }
];
