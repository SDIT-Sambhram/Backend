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
    const { order_id } = payload.payment.entity;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const participant = await Participant.findOne({ 'registrations.order_id': order_id }).session(session);
        if (!participant) {
            throw new Error('Participant not found');
        }

               // If QR code was not generated yet, generate it here
               if (!participant.qr_code || participant.qr_code === 'pending') {
                    participant.qr_code = await generateQRCode(participant._id);
            }

        // Update registration with payment details
        participant.registrations = participant.registrations.map(reg => {
            if (reg.order_id === order_id) {
                return {
                    ...reg,
                    payment_status: 'paid',
                    registration_date: new Date()
                };
            }
            return reg;
        });

        await participant.save({ session });
        await session.commitTransaction();

        console.log('Payment successful for order:', order_id);

        res.status(200).send({'Webhook received successfully'});
    } catch (error) {
        await session.abortTransaction();
        console.error('Error during webhook processing:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
    } finally {
        session.endSession();
    }
};
