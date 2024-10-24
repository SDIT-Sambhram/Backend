// registerController.js
import Participant from "../models/Participant.js";
import QRCode from "qrcode";
import mongoose from "mongoose";
import { body, validationResult } from 'express-validator';
import { createRegistrationImage } from './ticketGeneratorController.js'; // Import the PDF generator

// Constants
const validPaymentStatuses = ['paid', 'pending', 'failed'];

// Helper function to validate request body
const validateRequestBody = ({ name, usn, phone, college, registrations }) => {
    if (!name || !usn || !phone || !college || !registrations || registrations.length === 0) {
        return 'All fields are required';
    }
    return null;
};

// Helper function to generate QR code
const generateQRCode = async (participantId, eventId) => {
    const qrUrl = `http://localhost:8081/verify/${participantId}/${eventId}`;
    return await QRCode.toDataURL(qrUrl);
};

// Middleware for input validation
const validateInputs = [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('usn').isString().notEmpty().withMessage('USN is required'),
    body('phone').isString().notEmpty().withMessage('Phone is required'),
    body('college').isString().notEmpty().withMessage('College is required'),
    body('registrations').isArray().notEmpty().withMessage('At least one registration is required')
];

export const registerController = [
    validateInputs,
    async (request, response) => {
        try {
            // Validate request body
            const errors = validationResult(request);
            if (!errors.isEmpty()) {
                return response.status(400).json({ errors: errors.array() });
            }

            const { name, usn, phone, college, registrations } = request.body;

            // Validate payment status for each registration
            for (let registration of registrations) {
                if (!validPaymentStatuses.includes(registration.payment_status)) {
                    return response.status(400).send({ message: 'Invalid payment status' });
                }
            }

            // Check for unique event IDs in the registrations array
            const eventIds = registrations.map(reg => reg.event_id.toString());
            const uniqueEventIds = new Set(eventIds);

            if (uniqueEventIds.size !== eventIds.length) {
                return response.status(400).send({ message: 'User cannot select the same Event' });
            }

            // Check if the participant already exists
            let participant = await Participant.findOne({ phone });

            if (participant) {
                // Check if the participant has already registered for less than 3 events
                if (participant.registrations.length >= 3) {
                    return response.status(400).send({ message: 'User can register for a maximum of 3 events' });
                }

                // Create a Set of existing event IDs for faster lookup
                const existingEventIds = new Set(participant.registrations.map(reg => reg.event_id.toString()));

                // Check for duplicates in incoming registrations
                for (let registration of registrations) {
                    // Check if the event_id is already registered
                    if (existingEventIds.has(registration.event_id.toString())) {
                        return response.status(400).send({ message: `Event ID ${registration.event_id} is already registered.` });
                    }

                    // Generate QR code for the new registration
                    registration.qr_code = await generateQRCode(participant._id, registration.event_id);
                    participant.registrations.push(registration);
                }
            } else {
                // Check if the total registrations for the new participant exceed 3
                if (registrations.length > 3) {
                    return response.status(400).send({ message: 'User can register for a maximum of 3 events' });
                }

                // Generate QR code for each registration
                const participantId = new mongoose.Types.ObjectId();
                for (let registration of registrations) {
                    registration.qr_code = await generateQRCode(participantId, registration.event_id);
                }

                // Create a new participant
                participant = new Participant({
                    name,
                    usn,
                    phone,
                    college,
                    registrations
                });
            }

            // Save the participant
            await participant.save();

            // Generate the PDF
            const imagePath = await createRegistrationImage(participant, registrations);

            // Return success response with the path to the generated PDF
            return response.status(201).send({
                success: true,
                message: 'User registered successfully',
                imagePath, // Include the path to the PDF
                participant
            });
        } catch (error) {
            console.error(error); // Log the error
            return response.status(500).send({ message: 'Internal Server Error', error: error.message });
        }
    }
];
