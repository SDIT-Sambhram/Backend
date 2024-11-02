import crypto from 'crypto';
import Participant from '../models/Participant.js';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import mongoose from 'mongoose';
import dotenv from "dotenv";

dotenv.config();

export const razorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify the signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== req.headers['x-razorpay-signature']) {
        console.error('Invalid signature');
        return res.status(400).json({ message: 'Invalid signature' });
    }

    const { payload } = req.body;
    const { order_id } = payload.payment.entity;
    const phone = payload.payment.entity.notes.phone;

    console.log(payload);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find participant by phone number
        const participant = await Participant.findOne({ phone }).session(session);
        if (!participant) {
            throw new Error('Participant not found');
        }

        // Generate QR code if not generated yet
        if (!participant.qr_code || participant.qr_code === 'pending') {
            participant.qr_code = await generateQRCode(participant._id);
        }

        // Find and update the specific registration with the matching order_id
        const registrationIndex = participant.registrations.findIndex(reg => reg.order_id === order_id);
        if (registrationIndex !== -1) {
            participant.registrations[registrationIndex].payment_status = 'paid';
            participant.registrations[registrationIndex].registration_date = new Date();
        } else {
            throw new Error('Registration with given order_id not found');
        }

        // Save participant with updated registration details
        await participant.save({ session });
        await session.commitTransaction();

        console.log('Payment successful for order:', order_id);
        return res.status(200).json({ message: 'Webhook received successfully' });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error('Error during webhook processing:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    } finally {
        session.endSession();
    }
};
