import Participant from "../models/Participant.js";


// Route to verify QR code
export const qrVerification = async (req, res) => {
    const { participantId, eventId } = req.params;

    try {
        // Find the participant by ID
        const participant = await Participant.findById(participantId);

        if (!participant) {
            return res.status(404).send({ message: 'Participant not found' });
        }

        // Check if the event ID exists in the participant's registrations
        const registration = participant.registrations.find(reg => reg.event_id.toString() === eventId);

        if (!registration) {
            return res.status(404).send({ message: 'Registration not found for this event' });
        }

        // Return success response
        return res.status(200).send({
            success: true,
            message: 'QR code verified successfully',
            participant,
            registration
        });
    } catch (error) {
        console.error(error); // Log the error
        return res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
};
