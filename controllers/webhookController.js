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
    const { payment_id, order_id } = payload.payment.entity;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const participant = await Participant.findOne({ 'registrations.order_id': order_id }).session(session);
        if (!participant) {
            throw new Error('Participant not found');
        }

        const qrCode = await generateQRCode(participant._id);

        participant.registrations = participant.registrations.map(reg => {
            if (reg.order_id === order_id) {
                return {
                    ...reg,
                    qr_code: qrCode,
                    payment_status: 'paid',
                    razorpay_payment_id: payment_id,
                    registration_date: new Date()
                };
            }
            return reg;
        });

        await participant.save({ session });
        await session.commitTransaction();

        res.status(200).json({ success: true });
    } catch (error) {
        await session.abortTransaction();
        console.log('Error during webhook processing:', error);
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
    } finally {
        session.endSession();
    }
};