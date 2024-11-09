import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js'; 


// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to update ticket image with participant details
export const updateTicketImage = async (name, phone) => {
  try {
    // Path to the base ticket image
    const baseTicketPath = path.join(__dirname, '../images/tickets/1.png');
    
    // Check if the QR code buffer (or Base64 string) is provided
    if (!qr_code) {
      throw new Error('QR code is required');
    }

    // Generate the QR code buffer using the provided data
    let qrCodeBuffer = await generateQRCode(participantId);

    // Ensure the base ticket image exists
    const ticketExists = await sharp(baseTicketPath).metadata().then(() => true).catch(() => false);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }

    // Create the updated image with participant details and QR code
    const updatedImageBuffer = await sharp(baseTicketPath)
      .resize(300, 825)  // Adjust dimensions as needed
      .composite([
        {
          input: Buffer.from(`
            <svg width="270" height="200">
              <style>
                .name { font-size: 24px; fill: #000000; font-weight: bold; }
                .phone { font-size: 20px; fill: #000000; }
              </style>
              <text x="50" y="50" class="name">Name: ${name}</text>
              <text x="50" y="100" class="phone">Phone: ${phone}</text>
            </svg>
          `),
          gravity: 'northwest',
        },
        {
          input: qrCodeBuffer,
          top: 300,
          left: 600,
        },
      ])
      .toBuffer();  // Generate the image buffer without saving to file

    console.log('Ticket image generated successfully in memory.');

    // Return the image buffer for further processing (e.g., upload to S3)
    return updatedImageBuffer;

  } catch (error) {
    // Handle any errors that may occur
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
