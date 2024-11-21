import Participant from "../models/Participant.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateTicket } from "../controllers/ticketGeneration.js";

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
    console.error("Invalid Razorpay webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Acknowledge webhook receipt immediately
  res.status(200).json({ success: true, message: "Webhook received" });

  const { payload } = req.body;
  console.log("Processing Razorpay webhook payload:", JSON.stringify(payload, null, 2));

  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;
  const { college, name, phone, registrations, usn } = notes;
  console.log("Payment details:", { college, name, phone, registrations, usn });

  try {
    // Find or create participant with better error handling
    let participant = await Participant.findOne({ phone });
    console.log(`Participant lookup result: ${participant ? 'Found existing' : 'Not found'} for phone: ${phone}`);

    if (!participant) {
      // Create new participant
      console.log("Creating new participant with data:", { name, usn, phone, college });
      const newParticipant = new Participant({
        name,
        usn,
        phone,
        college,
        registrations: [],
      });

      try {
        participant = await newParticipant.save();
        console.log(`Created new participant with ID: ${participant._id} for phone: ${phone}`);
        
        // Verify the participant was created
        const verifyParticipant = await Participant.findById(participant._id);
        if (!verifyParticipant) {
          throw new Error("Failed to verify newly created participant");
        }
        console.log("Verified new participant creation:", verifyParticipant);
      } catch (saveError) {
        console.error("Failed to save new participant:", {
          error: saveError.message,
          validationErrors: saveError.errors,
          phone,
          name
        });
        throw saveError;
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
      console.warn(`Duplicate payment detected: ${razorpay_payment_id}`);
      return;
    }

    // Process registrations
    const isPaid = status === "captured";
    console.log(`Processing registrations for payment status: ${status}`);

    const newRegistrations = await Promise.all(
      registrations.map(async (event) => {
        const { event_id } = event;
        console.log(`Generating ticket for event_id: ${event_id}`);

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

        console.log(`Ticket generation ${ticketUrl === 'failed' ? 'failed' : 'succeeded'} for event_id: ${event_id}`);

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
      console.log(`Successfully saved registrations for participant: ${participant._id}, phone: ${phone}`);
    } catch (saveError) {
      console.error("Failed to save registrations:", {
        error: saveError.message,
        participantId: participant._id,
        phone
      });
      throw saveError;
    }

    console.log(`Webhook processing completed successfully for payment: ${razorpay_payment_id}`);

  } catch (error) {
    console.error("Error processing webhook:", {
      error: error.message,
      stack: error.stack,
      paymentId: razorpay_payment_id,
      phone,
      context: error.context || 'Unknown context'
    });
  }
};