import { updateTicketImage } from '../helpers/imageUpdation.js';
import { uploadImageToS3 } from '../helpers/uploadImagetoS3.js';
import logger from '../utils/logger.js'; // Import the logger

export const generateTicket = async (participantId, name, phone, price, eventCount, order_id) => {
  try {
    logger.info(`Generating ticket for participant ID: ${participantId}`);

    // Generate the updated ticket image buffer directly
    const updatedImageBuffer = await updateTicketImage(participantId, name, phone, price, eventCount);

    logger.info('Ticket image updated successfull', {
      participantId,
      name,
      phone,
      eventCount,
      price,
    });

    // S3 Key based on participant ID
    const s3Key = `tickets/${order_id}.jpg`;

    // Upload the image buffer directly to S3
    const s3ImageUrl = await uploadImageToS3(s3Key, updatedImageBuffer);

    logger.info('Ticket generated successfully', { s3ImageUrl });

    return s3ImageUrl;
  } catch (error) {
    logger.error('Error generating ticket:', { error: error.message, stack: error.stack });
    throw new Error('Failed to generate ticket');
  }
};
