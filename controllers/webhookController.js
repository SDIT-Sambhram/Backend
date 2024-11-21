import Participant from "../models/Participant.js";
import crypto from "crypto";
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

  // Start transaction for atomic operations
  const session = await Participant.startSession();
  if (!session) {
    console.error("Failed to start session");
    return res.status(500).json({ error: "Failed to start database session" });
  }

  session.startTransaction();

  try {
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

    if (isPaid) {
      const ticketUrl = await generateTicket(
        participant._id,
        participant.name,
        phone,
        amount / 100,
        registrations.length,
        order_id
      );
      console.log("Generated ticket URL:", ticketUrl);

      registrations.forEach((event) => {
        const event_id = event.event_id;
        console.log(`Processing registration for event: ${event_id}`);

        const isAlreadyRegistered = participant.registrations.some(
          (reg) => reg.event_id.toString() === event_id
        );

        if (!isAlreadyRegistered) {
          newRegistrations.push({
            event_id,
            ticket_url: isPaid ? ticketUrl : "failed",
            amount: amount / 100,
            order_id,
            payment_status: isPaid ? "paid" : "failed",
            razorpay_payment_id,
            registration_date: new Date(),
          });
        }
      });
    }

    if (newRegistrations.length > 0) {
      participant.registrations.push(...newRegistrations);
    }

    await participant.save({ session });
    console.log(`Participant data saved for phone: ${phone}`);

    await session.commitTransaction();
    session.endSession();

    console.log(`Payment processed successfully: ${razorpay_payment_id}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error processing Razorpay webhook:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
