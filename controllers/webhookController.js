import Participant from "../models/Participant.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { generateTicket } from "../controllers/ticketGeneration.js";

class RazorpayWebhookHandler {
  // Logging utility
  static log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context
    };
    
    switch (level) {
      case 'error':
        console.error(JSON.stringify(logData, null, 2));
        break;
      case 'warn':
        console.warn(JSON.stringify(logData, null, 2));
        break;
      default:
        console.log(JSON.stringify(logData, null, 2));
    }
  }

  // Validate webhook signature
  static validateSignature(reqBody, receivedSignature, webhookSecret) {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(reqBody))
        .digest("hex");

      return receivedSignature === expectedSignature;
    } catch (error) {
      this.log('error', 'Signature validation error', { error: error.message });
      return false;
    }
  }

  // Sanitize and validate input data
  static validateWebhookPayload(payload) {
    const { payment, order } = payload;
    
    if (!payment?.entity) {
      throw new Error('Invalid payload structure');
    }

    const { 
      id: razorpay_payment_id, 
      order_id, 
      amount, 
      status, 
      notes = {} 
    } = payment.entity;

    const { college, name, phone, registrations = [], usn } = notes;

    // Input validation
    const errors = [];
    if (!name) errors.push('Missing participant name');
    if (!phone) errors.push('Missing phone number');
    if (!registrations.length) errors.push('No event registrations');
    if (!college) errors.push('Missing college');

    if (errors.length) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      razorpay_payment_id,
      order_id,
      amount,
      status,
      college,
      name,
      phone,
      registrations,
      usn
    };
  }

  // Create or update participant
  static async findOrCreateParticipant(participantData, session) {
    let participant = await Participant.findOne({ phone: participantData.phone }).session(session);

    if (!participant) {
      participant = new Participant({
        name: participantData.name,
        usn: participantData.usn,
        phone: participantData.phone,
        college: participantData.college,
        registrations: [],
      });
      this.log('info', `New participant created`, { phone: participantData.phone });
    }

    return participant;
  }

  // Process event registrations
  static async processRegistrations(participant, registrationData) {
    const { amount, order_id, razorpay_payment_id, status } = registrationData;
    const isPaid = status === "captured";

    return Promise.all(registrationData.registrations.map(async (event) => {
      const { event_id } = event;
      
      try {
        const ticketUrl = isPaid
          ? await generateTicket(
              participant._id,
              participant.name,
              registrationData.phone,
              amount / 100,
              registrationData.registrations.length,
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
          ...event
        };
      } catch (ticketError) {
        this.log('error', 'Ticket generation failed', {
          participantId: participant._id,
          eventId: event_id,
          error: ticketError.message
        });
        
        return {
          event_id,
          ticket_url: "failed",
          amount: amount / 100,
          order_id,
          payment_status: "failed",
          razorpay_payment_id,
          registration_date: new Date(),
          error: ticketError.message,
          ...event
        };
      }
    }));
  }

  // Main webhook handler
  static async handleWebhook(req, res) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    let session;

    try {
      // Signature validation
      const receivedSignature = req.headers["x-razorpay-signature"];
      if (!this.validateSignature(req.body, receivedSignature, webhookSecret)) {
        this.log('warn', 'Invalid Razorpay webhook signature');
        return res.status(400).json({ error: "Invalid signature" });
      }

      // Validate and extract payload data
      const validatedPayload = this.validateWebhookPayload(req.body.payload);
      this.log('info', 'Webhook payload received', { 
        paymentId: validatedPayload.razorpay_payment_id 
      });

      // Start transaction
      session = await mongoose.startSession();
      session.startTransaction();

      // Process participant
      const participant = await this.findOrCreateParticipant(validatedPayload, session);

      // Process registrations
      const newRegistrations = await this.processRegistrations(participant, validatedPayload);

      // Update participant
      participant.registrations.push(...newRegistrations);
      await participant.save({ session });
      
      this.log('info', 'Participant registrations updated', { 
        phone: participant.phone,
        registrationsCount: newRegistrations.length 
      });

      // Commit transaction
      await session.commitTransaction();
      
      this.log('info', 'Payment processed successfully', {
        paymentId: validatedPayload.razorpay_payment_id
      });
      
      return res.status(200).json({ success: true });

    } catch (error) {
      // Handle errors
      if (session?.inTransaction()) {
        await session.abortTransaction();
      }

      this.log('error', 'Webhook processing error', {
        error: error.message,
        stack: error.stack
      });

      const isValidationError = error.message.includes('Validation failed');
      return res.status(isValidationError ? 400 : 500).json({ 
        message: isValidationError ? error.message : 'Internal Server Error'
      });

    } finally {
      // Clean up
      if (session) {
        await session.endSession();
      }
    }
  }
}

// Export the webhook handler
export const razorpayWebhook = (req, res) => 
  RazorpayWebhookHandler.handleWebhook(req, res);