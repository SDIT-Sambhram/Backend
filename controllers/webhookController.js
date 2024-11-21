import Participant from "../models/Participant.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateTicket } from "../controllers/ticketGeneration.js";
import logger from "../utils/logger.js";

const validateSignature = (reqBody, receivedSignature, webhookSecret) => {
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(reqBody))
    .digest("hex");

  return receivedSignature === expectedSignature;
};

export const razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const receivedSignature = req.headers["x-razorpay-signature"];

  // Validate webhook signature
  if (!validateSignature(req.body, receivedSignature, webhookSecret)) {
    logger.error("Invalid Razorpay webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Acknowledge webhook receipt immediately
  res.status(200).json({ success: true, message: "Webhook received" });

  const { payload } = req.body;
  logger.info(`Processing Razorpay webhook payload: ${JSON.stringify(payload)}`);

  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;
  const { college, name, phone, registrations, usn } = notes;
  console.log(college, name, phone, registrations, usn);

  try {
    // Find or create participant with better error handling
    let participant = await Participant.findOne({ phone });
    logger.info(`Participant lookup result: ${participant ? 'Found existing' : 'Not found'} for phone: ${phone}`);

    if (!participant) {
      // Create new participant
      const newParticipant = new Participant({
        name,
        usn,
        phone,
        college,
        registrations: [],
      });

      try {
        participant = await newParticipant.save();
        logger.info(`Created new participant with ID: ${participant._id} for phone: ${phone}`);
      } catch (saveError) {
        logger.error(`Failed to save new participant:`, {
          error: saveError.message,
          phone,
          name
        });
        throw saveError; // Re-throw to be caught by outer catch block
      }
    }

    // Verify participant exists before proceeding
    if (!participant || !participant._id) {
      throw new Error(`Failed to find or create participant for phone: ${phone}`);
    }

    // Check for duplicate payment
    const existingPayment = participant.registrations.find(
      (reg) => reg.razorpay_payment_id === razorpay_payment_id
    );
    if (existingPayment) {
      logger.warn(`Duplicate payment detected: ${razorpay_payment_id}`);
      return;
    }

    // Process registrations
    const isPaid = status === "captured";
    logger.info(`Processing registrations for payment status: ${status}`);

    const newRegistrations = await Promise.all(
      registrations.map(async (event) => {
        const { event_id } = event;
        logger.info(`Generating ticket for event_id: ${event_id}`);

        const ticketUrl = isPaid
          ? await generateTicket(
              participant._id,
              participant.name,
              phone,
              amount / 100,
              registrations.length,
              order_id
            )
          : "failed";

        logger.info(`Ticket generation ${ticketUrl === 'failed' ? 'failed' : 'succeeded'} for event_id: ${event_id}`);

        return {
          event_id,
          ticket_url: ticketUrl,
          amount: amount / 100,
          order_id,
          payment_status: isPaid ? "paid" : "failed",
          razorpay_payment_id,
          registration_date: new Date(),
          ...event,
        };
      })
    );

    // Update participant with new registrations
    participant.registrations.push(...newRegistrations);
    
    try {
      await participant.save();
      logger.info(`Successfully saved registrations for participant: ${participant._id}, phone: ${phone}`);
    } catch (saveError) {
      logger.error(`Failed to save registrations:`, {
        error: saveError.message,
        participantId: participant._id,
        phone
      });
      throw saveError;
    }

    logger.info(`Webhook processing completed successfully for payment: ${razorpay_payment_id}`);

  } catch (error) {
    logger.error("Error processing webhook:", {
      error: error.message,
      stack: error.stack,
      paymentId: razorpay_payment_id,
      phone,
      context: error.context || 'Unknown context'
    });
  }
};