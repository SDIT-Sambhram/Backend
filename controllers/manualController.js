import Participant from "../models/Participant.js";
import { generateTicket } from "../controllers/ticketGeneration.js"; // Import your ticket generation function
import mongoose from "mongoose";

export const manualRegistration = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, usn, phone, college, registrations } = req.body;

    // Validate required fields
    if (!name || !usn || !phone || !college || !registrations || registrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields or registrations data",
      });
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
    } else {
      return res.status(400).json({
        success: false,
        message: "Participant already exists",
      });
    }

    // Add new registrations
    const ticketPromises = registrations.map(async (registration) => {
      const ticketUrl = await generateTicket(
        participant._id, // Participant ID
        name,
        phone,
        registration.amount,
        registrations.length,
        registration.order_id
      );

      return {
        event_id: registration.event_id,
        amount: registration.amount,
        order_id: registration.order_id,
        payment_status: "paid", // Since payment is assumed to be completed
        razorpay_payment_id: registration.razorpay_payment_id || null,
        ticket_url: ticketUrl,
        registration_date: new Date(),
      };
    });

    // Wait for all ticket URLs to be generated
    const updatedRegistrations = await Promise.all(ticketPromises);

    // Add the registrations to the participant
    participant.registrations.push(...updatedRegistrations);

    // Save participant
    await participant.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Participant created successfully with tickets generated",
      participant: {
        ...participant._doc,
        registrations: updatedRegistrations.map((registration) => ({
          ...registration._doc,
          ticket_url: registration.ticket_url, // Include ticket_url in the response
        })),
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error during manual registration:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
