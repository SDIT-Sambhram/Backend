import Participant from "../models/Participant.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateTicket } from "../controllers/ticketGeneration.js";

// Helper function for signature validation
const validateSignature = (reqBody, receivedSignature, webhookSecret) => {
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(reqBody))
    .digest("hex");

  return receivedSignature === expectedSignature;
};

export const razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Validate Webhook Signature
  const receivedSignature = req.headers["x-razorpay-signature"];
  if (!validateSignature(req.body, receivedSignature, webhookSecret)) {
    console.error("Invalid Razorpay webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const { payload } = req.body;
  console.log("Razorpay webhook payload:", payload);

  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;
  console.log("Razorpay payment details:", { razorpay_payment_id, order_id, amount, status, notes });

  const { college, name, phone, registrations = [], usn } = notes;
  console.log("Participant data:", { college, name, phone, registrations, usn });

  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // Find or create participant
    let participant = await Participant.findOne({ phone }).session(session);
    console.log(`Found participant: ${participant ? participant._id : "None"}`);

    if (!participant) {
      participant = new Participant({
        name,
        usn,
        phone,
        college,
        registrations: [],
      });
      console.log(`New participant created: ${phone}`);
    }

    const isPaid = status === "captured";
    const newRegistrations = [];

    // Use 'for...of' loop instead of 'forEach' for async handling
    for (const event of registrations) {
      const event_id = event.event_id;
      console.log(`Processing registration for event: ${event_id}`);

      // Check if participant is already registered for this event
      const existingRegistration = participant.registrations.find(
        (reg) => reg.event_id.toString() === event_id && reg.payment_status !== 'failed'
      );

      if (existingRegistration) {
        // If registration exists and is not failed, update the registration
        existingRegistration.payment_status = isPaid ? "paid" : "failed";
        existingRegistration.razorpay_payment_id = razorpay_payment_id;
        existingRegistration.ticket_url = isPaid
          ? await generateTicket(
              participant._id,
              participant.name,
              phone,
              amount / 100,
              registrations.length,
              order_id
            )
          : "failed";
        existingRegistration.registration_date = new Date();
        console.log(`Updated registration for event: ${event_id}`);
      } else {
        // If no registration exists for this event or the existing one is failed, create a new registration
        const ticketUrl = isPaid
          ? await generateTicket(
              participant._id,
              participant.name,
              phone,
              amount / 100,
              registrations.length,
              order_id
            )
          : "failed"; // If payment is not captured, set ticketUrl to "failed"

        newRegistrations.push({
          event_id,
          ticket_url: ticketUrl,
          amount: amount / 100,
          order_id,
          payment_status: isPaid ? "paid" : "failed",
          razorpay_payment_id,
          registration_date: new Date(),
        });
        console.log(`New registration created for event: ${event_id}`);
      }
    }

    // Add new registrations to the participant's registrations array
    if (newRegistrations.length > 0) {
      participant.registrations.push(...newRegistrations);
    }

    // Save participant with updated registrations
    await participant.save({ session });
    console.log(`Participant data saved for phone: ${phone}`);

    await session.commitTransaction();
    session.endSession();

    console.log(`Payment processed successfully: ${razorpay_payment_id}`);
    return res.status(200).json({ success: true });
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