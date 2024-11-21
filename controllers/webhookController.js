import crypto from "crypto";
import Participant from "../models/Participant.js";
import { generateTicket } from "../controllers/ticketGeneration.js";
import { Console } from "console";

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
  Console.log("Webhook payload", payload);
  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;

  // Early validation of participant details in notes
  const { name, usn, phone, college, registrations } = notes;
  if (!name || !phone || !usn || !college || !Array.isArray(registrations)) {
    return res.status(400).json({ error: "Incomplete or invalid participant details in notes" });
  }

  // Start transaction for atomic operations
  const session = await Participant.startSession();
  session.startTransaction();

  try {
    // Find or create participant
    let participant = await Participant.findOne({ phone }).session(session);

    // If participant doesn't exist, create a new one
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
      // Generate the ticket URL only once (not for each event)
      const ticketUrl = await generateTicket(
        participant._id,
        participant.name,
        phone,
        amount / 100, // Convert to actual currency
        registrations.length, // Total number of events
        order_id
      );

      // Collect new event registrations for the participant
      registrations.forEach((event_id) => {
        // Avoid duplicate event registrations
        const isAlreadyRegistered = participant.registrations.some(
          (reg) => reg.event_id.toString() === event_id
        );

        if (!isAlreadyRegistered) {
          newRegistrations.push({
            event_id,
            ticket_url: isPaid ? ticketUrl : "failed",
            amount: amount / 100, // Convert to actual currency
            order_id,
            payment_status: isPaid ? "paid" : "failed",
            razorpay_payment_id,
            registration_date: new Date(),
          });
        }
      });
    }

    // Save participant data with the new registrations
    await participant.save({ session });
    console.log(`Participant data saved for phone: ${phone}`);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    console.log(`Payment processed successfully: ${razorpay_payment_id}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    // Rollback transaction in case of errors
    await session.abortTransaction();
    session.endSession();

    console.error("Error processing Razorpay webhook:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
