import crypto from 'crypto';
import Participant from '../models/Participant.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateTicket } from './ticketGeneration.js';

dotenv.config();

export const razorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    if (!signature) {
        return res.status(400).json({ message: 'Missing signature' });
    }

    const digest = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (digest !== signature) {
        console.error('Invalid signature');
        return res.status(400).json({ message: 'Invalid signature' });
    }

    let session;
    try {
        const { payload } = req.body;
        console.log('Webhook payload:', payload);
        const { 
            order_id,
            notes: { phone, registrations: events },
            status: paymentStatus,
            amount
        } = payload.payment.entity;

        const price = amount / 100;
        const isPaid = paymentStatus === 'captured';

        session = await mongoose.startSession();
        session.startTransaction();

        const participant = await Participant.findOne(
            { 
                phone,
                'registrations.order_id': { $in: order_id.split(',') },
                'registrations.payment_status': { $in: [null, 'failed'] }
            },
            {
                name: 1,
                phone: 1,
                registrations: 1
            }
        ).session(session);

        if (!participant) {
            throw new Error('No matching participant or registration found');
        }

        const orderIds = order_id.split(',');
        const ticketPromises = isPaid ? 
            participant.registrations
                .filter(reg => orderIds.includes(reg.order_id))
                .map(reg => generateTicket(participant._id, participant.name, phone, price, 1)) : 
            [];

        const updateOperations = orderIds.map(orderId => ({
            updateOne: {
                filter: {
                    phone,
                    'registrations.order_id': orderId
                },
                update: {
                    $set: {
                        'registrations.$.payment_status': isPaid ? 'paid' : 'failed',
                        'registrations.$.registration_date': new Date()
                    }
                }
            }
        }));

        const imageUrls = await Promise.all(ticketPromises);
        for (let i = 0; i < updateOperations.length; i++) {
            if (imageUrls[i]) {
                updateOperations[i].updateOne.update.$set['registrations.$.ticket_url'] = imageUrls[i];
            }
        }

        const result = await Participant.bulkWrite(updateOperations, { session });

        if (result.modifiedCount === 0) {
            throw new Error('Failed to update registrations');
        }

        await session.commitTransaction();

        console.log(`Payment ${paymentStatus} processed for order: ${order_id}`);
        return res.status(200).json({ 
            message: 'Webhook processed successfully' 
        });

    } catch (error) {
        if (session?.inTransaction()) {
            await session.abortTransaction();
        }
        console.error('Webhook processing error:', error);
        return res.status(500).json({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};