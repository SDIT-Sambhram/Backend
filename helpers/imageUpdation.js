import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to update ticket image with participant details
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    // Path to the base ticket image
    const baseTicketPath = path.join(__dirname, `../images/tickets/${eventCount}.png`);

    // Generate the QR code base64 string using the provided data
    const qrCodeBase64 = await generateQRCode(participantId);
    const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');

    console.log('QR code generated successfully.', qrCodeBuffer);

    // Ensure the base ticket image exists
    const ticketExists = await sharp(baseTicketPath).metadata().then(() => true).catch(() => false);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }

    // Create the updated image with participant details and QR code
    const updatedImageBuffer = await sharp(baseTicketPath)
      .composite([
        {
          input: Buffer.from(`
            <svg width="300" height="200">
              <style>
                .name { font-size: 20px; fill: #E4E3E3; font-family: 'Montserrat'; }
                .phone { font-size: 20px; fill: #E4E3E3; font-family: 'Montserrat'; }
              </style>
              <text x="13" y="200" class="name">Name: ${name}</text>
              <text x="13" y="250" class="phone">Phone: ${phone}</text>
            </svg>
          `),
          gravity: 'northwest',
        },
        {
          input: Buffer.from(`
            <svg width="300" height="100">
              <style>
                .price { font-size: 20px; fill: #E4E3E3; font-family: 'Montserrat'; }
              </style>
              <text x="13" y="30" class="price">Events: ${eventCount} | Price: ${price}</text>
            </svg>
          `),
          gravity: 'northwest',
        },
        {
          input: qrCodeBuffer,
          top: 675,  // Positioned closer to the bottom
          left: 50,  // Center the QR code horizontally within the image width
        },
      ])
      .toBuffer();  // Generate the image buffer without saving to file

    console.log('Ticket image generated successfully in memory.');
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
