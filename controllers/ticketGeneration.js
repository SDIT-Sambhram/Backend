import updateTicketImage from '../helpers/imageUpdation.js';
import { uploadImageToS3 } from '../helpers/uploadImagetoS3.js';

export const generateTicket = async (participantId, name, phone, price, eventCount, order_id) => {
  try {
    console.log('Generating ticket for:', participantId);

    // Generate the updated ticket image buffer directly
    const updatedImageBuffer = await updateTicketImage(participantId, name, phone, price, eventCount);

    console.log('Ticket image updated successfully', updatedImageBuffer);

    // S3 Key based on participant ID
    const s3Key = `tickets/${order_id}.jpg`;

    // Upload the image buffer directly to S3
    const s3ImageUrl = await uploadImageToS3(s3Key, updatedImageBuffer);

    console.log('Ticket generated successfully:', s3ImageUrl);

    return s3ImageUrl;
  } catch (error) {
    console.error("Error generating ticket:", error);
    throw new Error('Failed to generate ticket');
  }
};