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
    const {
      order_id,
      notes: { phone, registrations: events },
      status: paymentStatus,
      amount
    } = payload.payment.entity;

    const price = amount / 100;
    const isPaid = paymentStatus === 'captured';

    console.log(`Processing payment for order: ${order_id}, status: ${paymentStatus}`);

    session = await mongoose.startSession();
    session.startTransaction();

    // Retryable operation: Fetch participant
    const participant = await retryWithBackoff(async () => {
      return Participant.findOne(
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
    }, 3, 1000);

    if (!participant) {
      console.error('No matching participant or registration found for phone:', phone, 'and order ID:', order_id);
      throw new Error('No matching participant or registration found');
    }

    const orderIds = order_id.split(',');

    // Generate tickets with retry logic
    const ticketPromises = isPaid
      ? participant.registrations
          .filter(reg => orderIds.includes(reg.order_id))
          .map(reg =>
            retryWithBackoff(() =>
              generateTicket(participant._id, participant.name, phone, price, events.length, order_id)
            )
          )
      : [];

    const imageUrls = await Promise.all(ticketPromises);

    // Update each matching registration with retry
    for (const orderId of orderIds) {
      const updateOperation = {
        $set: {
          'registrations.$[elem].payment_status': isPaid ? 'paid' : 'failed',
          'registrations.$[elem].registration_date': new Date()
        }
      };

      const imageUrl = imageUrls.shift();
      if (imageUrl) {
        updateOperation.$set['registrations.$[elem].ticket_url'] = imageUrl;
      }

      const updateResult = await retryWithBackoff(async () => {
        return Participant.updateOne(
          {
            phone,
            'registrations.order_id': orderId
          },
          updateOperation,
          {
            session,
            arrayFilters: [{ 'elem.order_id': orderId }]
          }
        );
      });

      if (updateResult.modifiedCount === 0) {
        console.error('Failed to update registration for order ID:', orderId);
        throw new Error(`Failed to update registration for order ID: ${orderId}`);
      }
    }

    await session.commitTransaction();

    console.log(`Payment ${paymentStatus} processed for order: ${order_id}`);
    console.log('Webhook payload:', payload);

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
