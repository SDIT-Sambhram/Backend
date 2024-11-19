import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { createOrder } from "../controllers/paymentController.js";
import registrationLimiter from '../middlewares/rateLimiter.js';
import { validateInputs } from '../helpers/validation.js';

const MAX_EVENTS = 4;

// Optimized for O(1) lookup using Set
const canRegisterForEvents = (existingRegistrations, newRegistrations) => {
    // Pre-filter failed payments - O(n) where n is number of existing registrations
    const activeRegistrations = existingRegistrations.filter(reg => reg.payment_status !== 'failed' && reg.payment_status !== null);
    
    if (activeRegistrations.length >= MAX_EVENTS) {
        return { 
            canRegister: false, 
            message: `User can register for up to ${MAX_EVENTS} unique events` 
        };
    }

    // Create Set for O(1) lookup - O(n) one-time operation
    const existingEventIds = new Set(activeRegistrations.map(reg => reg.event_id.toString()));
    
    // Check for conflicts - O(m) where m is number of new registrations
    for (const reg of newRegistrations) {
        if (existingEventIds.has(reg.event_id.toString())) {
            return { 
                canRegister: false, 
                message: 'User has already registered for the following events' 
            };
        }
    }

    return { canRegister: true };
};

export const registerParticipant = [
    // registrationLimiter,
    // validateInputs,
    async (req, res) => {
        let session;
        try {
            // Quick validation checks - O(1)
            if (!req.body.name || !req.body.usn || !req.body.phone || !req.body.college || !req.body.registrations?.length) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, usn, college, phone, amount, registrations } = req.body;

            console.log('Starting registration process for:', phone);

            // Start both operations concurrently - Parallel execution
            const [existingParticipant, order] = await Promise.all([
                // Only fetch necessary fields using projection
                Participant.findOne(
                    { phone }, 
                    { 'registrations.event_id': 1, 'registrations.payment_status': 1 }
                ).lean(),
                createOrder(amount, phone, registrations)
            ]);

            if (!order) {
                throw new Error('Order creation failed');
            }

            console.log('Order created successfully:', order.id);

            // Prepare registrations with order ID - O(m)
            const newRegistrations = registrations.map(reg => ({
                event_id: reg.event_id,
                order_id: order.id,
                amount,
                registration_date: new Date()
            }));

            session = await mongoose.startSession();
            session.startTransaction();

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

                // Single atomic update operation - O(1)
                await Participant.updateOne(
                    { phone },
                    { $push: { registrations: { $each: newRegistrations } } },
                    { session }
                );

                participantId = existingParticipant._id; // Use existing participant ID
                console.log('Updated existing participant:', participantId);
            } else {
                // Insert new participant and capture the created ID
                const newParticipant = await Participant.create([{
                    name,
                    usn,
                    phone,
                    college,
                    registrations: newRegistrations
                }], { session });
                
                participantId = newParticipant[0]._id; // Capture the new participant's ID
                console.log('Created new participant:', participantId);
            }

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
            console.error('Error during registration:', error);
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