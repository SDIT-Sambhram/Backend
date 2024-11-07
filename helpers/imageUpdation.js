import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to update ticket image with participant details
export const updateTicketImage = async (name, phone, qr_code) => {
  try {
    // Path to the base ticket image
    const baseTicketPath = path.join(__dirname, '../images/tickets/1.png');
    
    // Check if the QR code buffer is provided
    if (!qr_code) {
      throw new Error('QR code buffer is required');
    }

    // Ensure the base ticket image exists (optional, for additional safety)
    const ticketExists = await sharp(baseTicketPath).metadata().then(() => true).catch(() => false);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }

    // Resize the base image and overlay the text and QR code
    const updatedImageBuffer = await sharp(baseTicketPath)
      .resize(1875, 5156)  // Ensure these dimensions fit the base image
      .composite([
        // Overlay the participant details (name, phone)
        {
          input: Buffer.from(`
            <svg width="1875" height="5156">
              <style>
                .name { font-size: 48px; fill: #000000; }
                .phone { font-size: 48px; fill: #000000; }
              </style>
              <text x="50" y="150" class="name">Name: ${name}</text>
              <text x="50" y="250" class="phone">Phone: ${phone}</text>
            </svg>
          `),
          gravity: 'northwest',
        },
        // Overlay the QR code image at the specified position
        {
          input: qr_code,
          top: 1200,  // Adjust top position as needed
          left: 1600, // Adjust left position as needed
        },
      ])
      .toBuffer();

    // Return the updated image buffer
    return updatedImageBuffer;

  } catch (error) {
    // Handle any errors that may occur
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
