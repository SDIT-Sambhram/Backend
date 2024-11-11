// registerController.js
import Participant from "../models/Participant.js";
import QRCode from "qrcode";
import mongoose from "mongoose";
import { body, validationResult } from 'express-validator';
import { createRegistrationImage } from './ticketGeneratorController.js'; // PDF generator import

// Constants
const validPaymentStatuses = new Set(['paid', 'pending', 'failed']); // Use Set for O(1) lookup on payment statuses

// Helper function to generate QR code with participant and event info
const generateQRCode = async (participantId, eventId) => {
    const qrUrl = `http://localhost:8081/verify/${participantId}/${eventId}`;
    return QRCode.toDataURL(qrUrl); // Convert URL to QR code
};

// Middleware to validate input fields
const validateInputs = [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('usn').isString().notEmpty().withMessage('USN is required'),
    body('phone').isString().notEmpty().withMessage('Phone is required'),
    body('college').isString().notEmpty().withMessage('College is required'),
    body('registrations').isArray().notEmpty().withMessage('At least one registration is required')
];

// Main controller for user registration
export const registerController = [
    validateInputs, // Apply input validation
    async (req, res) => {
        try {
            // Validate the request body for errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, usn, phone, college, registrations } = req.body;

            // Check if each registration has a valid payment status
            if (registrations.some(reg => !validPaymentStatuses.has(reg.payment_status))) {
                return res.status(400).send({ message: 'Invalid payment status' });
            }

            // Ensure no duplicate event registrations
            const eventIds = registrations.map(reg => reg.event_id.toString());
            if (new Set(eventIds).size !== eventIds.length) {
                return res.status(400).send({ message: 'User cannot select the same event multiple times' });
            }

            // Check if participant already exists by phone number
            let participant = await Participant.findOne({ phone }).exec();

            if (participant) {
                const existingEventIds = new Set(participant.registrations.map(reg => reg.event_id.toString()));

                // Ensure participant doesn't exceed 3 event registrations
                if (participant.registrations.length + registrations.length > 3) {
                    return res.status(400).send({ message: 'User can register for a maximum of 3 events' });
                }

                // Handle new event registrations
                const newRegistrations = [];
                for (let reg of registrations) {
                    if (existingEventIds.has(reg.event_id.toString())) {
                        return res.status(400).send({ message: `Event ID ${reg.event_id} is already registered.` });
                    }

                    // Generate QR code for new events
                    reg.qr_code = await generateQRCode(participant._id, reg.event_id);
                    newRegistrations.push(reg);
                }

                // Add new registrations to participant
                participant.registrations.push(...newRegistrations);
            } else {
                // Ensure new participant doesn't exceed 3 events
                if (registrations.length > 3) {
                    return res.status(400).send({ message: 'User can register for a maximum of 3 events' });
                }

                // Generate QR codes for all new registrations
                const participantId = new mongoose.Types.ObjectId();
                for (let reg of registrations) {
                    reg.qr_code = await generateQRCode(participantId, reg.event_id);
                }

                // Create a new participant with all registrations
                participant = new Participant({
                    name,
                    usn,
                    phone,
                    college,
                    registrations
                });
            }

            // Save the participant to the database
            await participant.save();

            // Generate and return the registration PDF
            const imagePath = await createRegistrationImage(participant, registrations);

            // Send success response with the PDF path and participant details
            return res.status(201).json({
                success: true,
                message: 'User registered successfully',
                imagePath, // Path to the generated PDF
                participant
            });
        } catch (error) {
            console.error(error); // Log the error for debugging
            return res.status(500).json({ message: 'Internal Server Error', error: error.message });
        }
    }
];
