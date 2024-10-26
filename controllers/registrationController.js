import Participant from "../models/Participant.js";
import mongoose from "mongoose";
import { validationResult } from 'express-validator';
import { createOrder, verifyPayment } from "../controllers/paymentController.js";
import { generateQRCode } from "../helpers/qrCodeGenerator.js";
import registrationLimiter from '../middlewares/rateLimiter.js';
import { validateInputs } from '../helpers/validation.js';

export const registerController = [
    registrationLimiter,
    validateInputs,
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { name, usn, phone, college, registrations, amount } = req.body;

            const participant = await Participant.findOne({ phone });

            if (participant) {
                const existingEventIds = new Set(participant.registrations.map(reg => reg.event_id.toString()));
                if (participant.registrations.length >= 4) {
                    return res.status(400).json({ message: 'User can register for up to 4 unique events' });
                }
                if (registrations.some(reg => existingEventIds.has(reg.event_id.toString()))) {
                    return res.status(400).json({ message: 'User has already registered for one or more events' });
                }
            } else {
                if (registrations.length > 4) {
                    return res.status(400).json({ message: 'User can register for up to 4 unique events' });
                }
            }

            const order = await createOrder(amount);
            if (!order?.id) return res.status(500).json({ message: 'Order creation failed' });

            res.status(200).json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency });
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).send({ message: 'Internal Server Error', error: error.message });
        }
    }
];

export const verifyAndRegisterParticipant = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, name, usn, phone, college, registrations } = req.body;

        // Check for missing fields
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !name || !usn || !phone || !college || !registrations || registrations.length === 0) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Verify payment
        if (!verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
            return res.status(400).json({ message: "Payment verification failed" });
        }

        let participant = await Participant.findOne({ phone });
        const qrCode = await generateQRCode(participant ? participant._id : new mongoose.Types.ObjectId());

        const newRegistrations = registrations.map(reg => ({
            event_id: reg.event_id,
            qr_code: qrCode,
            payment_status: 'paid',
            razorpay_payment_id,
            registration_date: new Date()
        }));

        if (!participant) {
            participant = new Participant({ name, usn, phone, college, registrations: newRegistrations });
        } else {
            const existingEventIds = new Set(participant.registrations.map(reg => reg.event_id.toString()));
            if (participant.registrations.length + newRegistrations.length > 4) {
                return res.status(400).json({ message: 'User can register for up to 4 unique events' });
            }
            if (newRegistrations.some(reg => existingEventIds.has(reg.event_id.toString()))) {
                return res.status(400).json({ message: 'User has already registered for one or more events' });
            }
            participant.registrations.push(...newRegistrations);
        }

        await participant.save();

        const ticketUrl = `http://frontend-url/ticket/${qrCode}`;
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            redirectUrl: ticketUrl,
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
        console.error('Error during payment verification and registration:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
};
