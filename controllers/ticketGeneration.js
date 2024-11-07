
import { updateTicketImage } from '../helpers/imageUpdation.js';
// import { uploadImageToS3 } from '../helpers/uploadImagetoS3.js';
// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateTicket = async (participantId, name, phone, qr_code) => {
  try {

    console.log('Generating ticket for:', name, phone, qr_code);
    // Update the ticket image
    const path = await updateTicketImage(name, phone, qr_code);

    console.log('Ticket generated successfully!', path);

      // Define the path to save the updated image locally

    // // S3 Key based on participant ID
    // const s3Key = `tickets/${participant._id}.png`;

    // // Upload to S3
    // const s3ImageUrl = await uploadImageToS3(updatedImageBuffer, s3Key);

    // res.json({ success: true, ticketUrl: s3ImageUrl });
  } catch (error) {
    console.error("error in generating ticket", error);
  }
};

