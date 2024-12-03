import Participant from "../models/Participant.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateTicket } from "../controllers/ticketGeneration.js";

export const razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Validate Webhook Signature
  const receivedSignature = req.headers["x-razorpay-signature"];
  if (!validateSignature(req.body, receivedSignature, webhookSecret)) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  const { payload } = req.body;
  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;

  const { college, name, phone, registrations = [], usn } = notes;

  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // Find existing participant and check for existing order, ignoring failed payment events
    const existingParticipant = await Participant.findOne({ 
      phone,
      registrations: {
        $elemMatch: { 
          order_id: order_id,
          event_id: { $in: registrations.map(reg => reg.event_id) },
          payment_status: { $ne: 'failed' }
        }
      }
    }).session(session);

    // If exact order and event combination already exists, return success to prevent duplicates
    if (existingParticipant) {
      console.warn(`Duplicate order detected: ${order_id}`);
      await session.commitTransaction();
      return res.status(200).json({ success: true, message: "Order already processed" });
    }

    // Find or create participant
    let participant = await Participant.findOne({ phone }).session(session);

    if (!participant) {
      participant = new Participant({
        name,
        usn,
        phone,
        college,
        registrations: [],
      });
    }

    const isPaid = status === "captured";
    const newRegistrations = [];

    for (const event of registrations) {
      const event_id = event.event_id;

      // Check for duplicate registration within existing registrations, ignoring failed events
      const isDuplicateRegistration = participant.registrations.some(
        reg => reg.event_id.toString() === event_id && reg.payment_status !== 'failed'
      );

      if (isDuplicateRegistration) {
        console.warn(`Skipping duplicate registration for event: ${event_id}`);
        continue;
      }

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

      newRegistrations.push({
        event_id,
        ticket_url: ticketUrl,
        amount: amount / 100,
        order_id,
        payment_status: isPaid ? "paid" : "failed",
        razorpay_payment_id,
        registration_date: new Date(),
      });
    }

    // Add new registrations to the participant's registrations array
    if (newRegistrations.length > 0) {
      participant.registrations.push(...newRegistrations);
      await participant.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ 
      success: true, 
      registrationsAdded: newRegistrations.length 
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