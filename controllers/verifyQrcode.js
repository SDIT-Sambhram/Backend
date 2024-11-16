import Participant from '../models/Participant.js';

// Get participant by ID
export const verifyTicket = async (req, res) => {
    try {
      const { id } = req.body;
      const participant = await Participant.findById(id);
      if (!participant) {
        return res.status(404).json({ message: 'Participant not found' });
      }
      res.status(200).json(participant);
    } catch (error) {
      console.error('Error fetching participant:', error);
      res.status(500).json({ message: 'Error fetching participant', error: error.message });
    }
  };