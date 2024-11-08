import { updateTicketImage } from '../helpers/imageUpdation.js';
import { uploadImageToS3 } from '../helpers/uploadImagetoS3.js';

export const generateTicket = async (participantId, name, phone, qr_code) => {
  try {
    console.log('Generating ticket for:', name, phone, qr_code);

    // Generate the updated ticket image buffer directly
    const updatedImageBuffer = await updateTicketImage(name, phone, qr_code);

    // S3 Key based on participant ID
    const s3Key = `tickets/${participantId}.png`;

    // Upload the image buffer directly to S3
    const s3ImageUrl = await uploadImageToS3(updatedImageBuffer, s3Key);

    console.log('Ticket generated successfully:', s3ImageUrl);

    return s3ImageUrl;
  } catch (error) {
    console.error("Error generating ticket:", error);
  }
};
