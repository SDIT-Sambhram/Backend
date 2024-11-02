import crypto from 'crypto';
import Participant from '../models/Participant.js';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import mongoose from 'mongoose';
import dotenv from "dotenv";

dotenv.config();

export const razorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== req.headers['x-razorpay-signature']) {
        return res.status(400).json({ message: 'Invalid signature' });
    }

    const { payload } = req.body;
    const { order_id: webhookOrderId } = payload.payment.entity;

    const session = await mongoose.startSession();
    session.startTransaction();
    let transactionCommitted = false;

    try {
        const participant = await Participant.findOne({ 'registrations.order_id': webhookOrderId }).session(session);
        if (!participant) {
            throw new Error('Participant not found');
        }

        if (!participant.qr_code || participant.qr_code === 'pending') {
            participant.qr_code = await generateQRCode(participant._id);
        }

        const registration = participant.registrations.find(reg => reg.order_id === webhookOrderId);
        if (registration) {
            registration.payment_status = 'paid';
            registration.registration_date = new Date();
        } else {
            throw new Error('Registration not found for the given order_id');
        }

        await participant.save({ session });
        await session.commitTransaction();
        transactionCommitted = true;

        console.log('Payment successful for order:', order_id);

        res.status(200).send('Webhook received successfully');
    } catch (error) {
        if (!transactionCommitted) {
            await session.abortTransaction();
        }
        console.error('Error during webhook processing:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
    } finally {
        session.endSession();
    }
};
