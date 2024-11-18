import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { createOrder } from "../controllers/paymentController.js";
import registrationLimiter from '../middlewares/rateLimiter.js';

const MAX_EVENTS = 4;

// Helper function: Check if user can register for new events
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
                message: 'User has already registered for some of these events' 
            };
        }
    }

    return { canRegister: true };
};

// Helper function: Retry Axios requests
const retryAxios = async (axiosCall, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await axiosCall();
        } catch (error) {
            if (i === retries - 1 || error.response?.status !== 503) throw error;
            await new Promise(res => setTimeout(res, delay));
        }
    }
};

// Main registration function
export const registerParticipant = [
    // Middlewares
    // registrationLimiter,
    async (req, res) => {
        let session;

        try {
            // Validate request body
            if (!req.body.name || !req.body.usn || !req.body.phone || !req.body.college || !req.body.registrations?.length) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, usn, college, phone, amount, registrations } = req.body;

            // Fetch existing participant and create order concurrently
            const [existingParticipant, order] = await Promise.all([
                Participant.findOne(
                    { phone }, 
                    { 'registrations.event_id': 1, 'registrations.payment_status': 1 }
                ).lean(),
                retryAxios(() => createOrder(amount, phone, registrations))
            ]);

            if (!order) {
                return res.status(500).json({ message: 'Order creation failed' });
            }

            // Prepare new registrations
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
                    await session.endSession();
                    return res.status(400).json({ message });
                }

                await Participant.updateOne(
                    { phone },
                    { $push: { registrations: { $each: newRegistrations } } },
                    { session }
                );
                participantId = existingParticipant._id;
            } else {
                const newParticipant = await Participant.create([{
                    name,
                    usn,
                    phone,
                    college,
                    registrations: newRegistrations
                }], { session });
                participantId = newParticipant[0]._id;
            }

            await session.commitTransaction();
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

            console.error('Error during registration:', error.message);
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
            });

        } finally {
            if (session) {
                await session.endSession();
            }
      }
    }
];