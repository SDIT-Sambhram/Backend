import crypto from 'crypto';
import Participant from '../models/Participant.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateTicket } from './ticketGeneration.js';

dotenv.config();

// Retry utility with exponential backoff
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  while (retries > 0) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 1) {
        console.warn(`Retrying after delay (${delay}ms)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        retries--;
      } else {
        throw error; // Exhaust retries
      }
    }
  }
};

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

    if (!order_id || !phone || !events) {
      console.error('Invalid payload:', req.body);
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const price = amount / 100;
    const isPaid = paymentStatus === 'captured';

    session = await mongoose.startSession();
    session.startTransaction();

    const participant = await retryWithBackoff(async () =>
      Participant.findOne(
        {
          phone,
          'registrations.order_id': { $in: [order_id] },
          'registrations.payment_status': { $in: [null, 'failed'] }
        },
        { name: 1, phone: 1, registrations: 1 }
      ).session(session)
    );

    if (!participant) {
      console.error('No matching participant or registration found:', { phone, order_id });
      throw new Error('No matching participant or registration found');
    }

    if (participant.registrations.some(reg => reg.order_id === order_id && reg.payment_status === 'paid')) {
      console.log('Duplicate webhook detected, skipping...');
      return res.status(200).json({ message: 'Duplicate webhook' });
    }

    const ticketUrl = isPaid
      ? await retryWithBackoff(() =>
          generateTicket(participant._id, participant.name, phone, price, events.length, order_id)
        )
      : null;

    const updateOperation = {
      $set: {
        'registrations.$[elem].payment_status': isPaid ? 'paid' : 'failed',
        'registrations.$[elem].registration_date': new Date(),
        ...(ticketUrl && { 'registrations.$[elem].ticket_url': ticketUrl })
      }
    };

    await retryWithBackoff(async () =>
      Participant.updateOne(
        {
          phone,
          'registrations.order_id': order_id
        },
        updateOperation,
        {
          session,
          arrayFilters: [{ 'elem.order_id': order_id }]
        }
      )
    );

    await session.commitTransaction();

    console.log(`Payment ${paymentStatus} processed for order: ${order_id}`);
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Webhook processing error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
