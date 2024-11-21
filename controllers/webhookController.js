import Participant from "../models/Participant.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateTicket } from "../controllers/ticketGeneration.js";
import logger from "../utils/logger.js"; // Import the logger

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

  if (!validateSignature(req.body, receivedSignature, webhookSecret)) {
    logger.error("Invalid Razorpay webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  res.status(200).json({ success: true, message: "Webhook received" }); // Respond immediately to Razorpay

  const { payload } = req.body;
  logger.info(`Razorpay webhook payload received: ${JSON.stringify(payload)}`);

  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;
  const { college, name, phone, registrations, usn } = notes;

  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    let participant = await Participant.findOne({ phone }).session(session);
    logger.info(`Found participant: ${participant ? participant._id : "None"}`);

    if (!participant) {
      participant = new Participant({
        name,
        usn,
        phone,
        college,
        registrations: [],
      });
      logger.info(`Created new participant: ${phone}`);
    }

    // Check for duplicate payment
    const existingPayment = participant.registrations.find(
      (reg) => reg.razorpay_payment_id === razorpay_payment_id
    );
    if (existingPayment) {
      logger.warn(`Duplicate payment detected: ${razorpay_payment_id}`);
      await session.abortTransaction();
      return;
    }

    const isPaid = status === "captured";
    const newRegistrations = await Promise.all(
      registrations.map(async (event) => {
        const { event_id } = event;

        // Generate ticket only if payment is captured
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

    participant.registrations.push(...newRegistrations);

    await participant.save({ session });
    logger.info(`Participant data saved successfully: ${phone}`);

    await session.commitTransaction();
    logger.info(`Transaction committed successfully: ${razorpay_payment_id}`);
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    logger.error(`Error processing webhook: ${error.message}`, { error });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
