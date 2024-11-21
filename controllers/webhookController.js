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
  console.log("====== Starting Webhook Processing ======");
  
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
  const { id: razorpay_payment_id, order_id, amount, status, notes = {} } = payload.payment.entity;
  const { college, name, phone, registrations, usn } = notes;

  // Debug log all input data
  console.log("====== Input Validation ======");
  console.log("MongoDB Connection State:", mongoose.connection.readyState);
  console.log("Required Fields:", {
    name: Boolean(name),
    usn: Boolean(usn),
    phone: Boolean(phone),
    college: Boolean(college),
    registrations: Array.isArray(registrations)
  });
  console.log("Data Types:", {
    name: typeof name,
    usn: typeof usn,
    phone: typeof phone,
    college: typeof college,
    registrationsType: typeof registrations
  });
  console.log("Values:", { name, usn, phone, college, registrations });

  try {
    console.log("====== Participant Lookup ======");
    // Find or create participant with better error handling
    let participant;
    try {
      participant = await Participant.findOne({ phone });
      console.log("Find Result:", participant ? "Found existing participant" : "No existing participant");
    } catch (findError) {
      console.error("Error in findOne:", findError.message);
      throw findError;
    }

    if (!participant) {
      console.log("====== Creating New Participant ======");
      // Validate data before creation
      if (!name || !usn || !phone || !college) {
        throw new Error(`Missing required fields: ${JSON.stringify({ name, usn, phone, college })}`);
      }

      const participantData = {
        name: name.trim(),
        usn: usn.trim(),
        phone: phone.trim(),
        college: college.trim(),
        registrations: []
      };

      console.log("Creating participant with data:", participantData);

      try {
        const newParticipant = new Participant(participantData);
        
        // Log validation results
        const validationError = newParticipant.validateSync();
        if (validationError) {
          console.error("Validation Error:", validationError);
          throw validationError;
        }

        participant = await newParticipant.save();
        console.log("New participant created:", participant._id);

        // Verify creation
        const verifyParticipant = await Participant.findById(participant._id);
        if (!verifyParticipant) {
          throw new Error("Participant creation verification failed");
        }
        console.log("Participant creation verified");
      } catch (saveError) {
        console.error("Save Error:", {
          message: saveError.message,
          name: saveError.name,
          errors: saveError.errors,
          code: saveError.code // This will show 11000 if it's a duplicate key error
        });
        throw saveError;
      }
    }

    // Rest of your existing code...
    // Process registrations and save them...

    console.log("====== Webhook Processing Complete ======");

  } catch (error) {
    console.error("====== Error in Webhook Processing ======");
    console.error("Error Type:", error.constructor.name);
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    if (error.code === 11000) {
      console.error("Duplicate key error - phone number already exists");
    }
    if (error.errors) {
      console.error("Validation Errors:", JSON.stringify(error.errors, null, 2));
    }
  }
};