import crypto from 'crypto';
import Participant from '../models/Participant.js';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateTicket } from './ticketGeneration.js';

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
    const paymentStatus = payload.payment.entity.status;
    const price = payload.payment.entity.amount;  // assuming 'amount' is in smallest currency unit (e.g., paise for INR)

    console.log(payload);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find participant by phone number
        const participant = await Participant.findOne({ phone }).session(session);
        if (!participant) {
            throw new Error('Participant not found');
        }

         // Calculate registration count
         const eventCount = participant.registrations.filter(reg => reg.payment_status === 'paid').length;
         
         // Generate ticket image if payment is successful
         if (paymentStatus === 'captured') {
            const imageUrl = await generateTicket(participant._id, participant.name, phone, price, eventCount);
            console.log(`Ticket image URL: ${imageUrl}`);
        }

        // Flag to check if any registration was updated
        let registrationUpdated = false;

        // Loop through all registrations to update matching entries
        for (let reg of participant.registrations) {
            if (reg.order_id === order_id && (reg.payment_status === null || reg.payment_status === 'failed')) {
                // Update payment status and registration date
                reg.payment_status = paymentStatus === 'captured' ? 'paid' : 'failed';
                reg.ticket_url = imageUrl || null;
                reg.registration_date = new Date();
                registrationUpdated = true;
            }
        }

        if (!registrationUpdated) {
            throw new Error('No matching pending registration found for the provided order_id');
        }

        // Save participant with updated registration details
        await participant.save({ session });

       

        await session.commitTransaction();

        console.log(`Payment ${paymentStatus} for order: ${order_id}`);
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
