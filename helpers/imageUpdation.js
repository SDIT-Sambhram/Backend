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
    console.log('Base ticket path:', baseTicketPath);

    // Generate the QR code base64 string using the provided data
    const qrCodeBase64 = await generateQRCode(participantId);
    const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');
    console.log('QR code generated successfully.', qrCodeBuffer);

    // Ensure the base ticket image exists
    const ticketExists = await sharp(baseTicketPath).metadata().then(() => true).catch(() => false);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }
    console.log('Base ticket image exists.');

    // Create the updated image with participant details and QR code
    const updatedImageBuffer = await sharp(baseTicketPath)
      .composite([
        {
          input: Buffer.from(`
            <svg width="300" height="825">
              <style>
                @font-face {
                  font-family: 'Montserrat';
                  src: url('https://fonts.gstatic.com/s/montserrat/v15/4qk3rYp1u6qU5QmGk5u8NQ.ttf') format('truetype');
                }
                .name { font-size: 18px; fill: #E4E3E3; font-family: 'Montserrat'; }
                .phone { font-size: 18px; fill: #E4E3E3; font-family: 'Montserrat'; }
              </style>
              <text x="15" y="160" class="name">Name: ${name}</text>
              <text x="15" y="300" class="phone">Phone: ${phone}</text>
            </svg>
          `, 'utf-8'),
          gravity: 'northwest',
        },
        {
          input: Buffer.from(`
            <svg width="300" height="825">
              <style>
                @font-face {
                  font-family: 'Montserrat';
                  src: url('https://fonts.gstatic.com/s/montserrat/v15/4qk3rYp1u6qU5QmGk5u8NQ.ttf') format('truetype');
                }
                .eventCount { font-size: 18px; fill: #E4E3E3; font-family: 'Montserrat'; }
                .price { font-size: 20px; fill: #E4E3E3; font-family: 'Montserrat'; }
              </style>
              <text x="65" y="540" class="eventCount">${eventCount} </text>
              <text x="150" y="540" class="price">${price}</text>
            </svg>
          `, 'utf-8'),
          gravity: 'northwest',
        },
        {
          input: qrCodeBuffer,
          top: 660,  // Positioned closer to the bottom
          left: 75,  // Center the QR code horizontally within the image width
        },
      ])
      .toBuffer();  // Generate the image buffer without saving to file

    console.log('Ticket image generated successfully in memory.', name, phone, price, eventCount);
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};