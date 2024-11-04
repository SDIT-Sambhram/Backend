import crypto from 'crypto';
import Participant from '../models/Participant.js';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

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
    const { order_id, payment } = payload.payment.entity; // Destructure payment entity
    const phone = payment.notes.phone;
    const paymentStatus = payment.status; // Get the payment status

    console.log(payload);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find participant by phone number
        const participant = await Participant.findOne({ phone }).session(session);
        if (!participant) {
            throw new Error('Participant not found');
        }



        // Update registrations based on payment status
        let registrationUpdated = false;

        if (paymentStatus === 'captured') {
            // Payment successful
            for (let reg of participant.registrations) {
                if (reg.order_id === order_id && reg.payment_status === 'pending') {
                    reg.payment_status = 'paid';
                    reg.registration_date = new Date();
                    if (!reg.qr_code || reg.qr_code === 'pending') {
                        reg.qr_code = await generateQRCode(participant._id);// Generate the QR code upon payment capture
                    }

                    registrationUpdated = true;
                    break;
                }
            }
        }
        
        else if (paymentStatus === 'failed') {
            // Payment failed - update status to 'failed' but do not delete
            for (let reg of participant.registrations) {
                if (reg.order_id === order_id && reg.payment_status === 'pending') {
                    reg.payment_status = 'failed';
                    registrationUpdated = true;
                    break;
                }
            }
        }

        if (!registrationUpdated) {
            throw new Error('No matching pending registration found for the provided order_id');
        }

        // Save participant with updated registration details
        await participant.save({ session });
        await session.commitTransaction();

        console.log(`Payment ${paymentStatus} for order:`, order_id);
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
