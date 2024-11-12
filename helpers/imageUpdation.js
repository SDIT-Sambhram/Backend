import path from 'path';
import fs from 'fs';
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
    const ticketExists = await fs.promises.access(baseTicketPath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }
    console.log('Base ticket image exists.');

    // Load the base ticket image
    const baseTicketBuffer = await fs.promises.readFile(baseTicketPath);

    // Create the updated image with participant details and QR code
    const updatedImageBuffer = await sharp(baseTicketBuffer)
      .composite([
        {
          input: Buffer.from(`
            <svg width="300" height="825">
              <style>
                .ticket-info {
                  font-family: Arial, sans-serif;
                  font-size: 18px;
                  fill: #E4E3E3;
                }
              </style>
              <text x="15" y="460" class="ticket-info">Name: shuhaib</text>
              <text x="15" y="500" class="ticket-info">Phone: ${phone}</text>
            </svg>
          `, 'utf-8'),
          gravity: 'northwest',
        },
        {
          input: Buffer.from(`
            <svg width="300" height="825">
              <style>
                .event-info {
                  font-family: Arial, sans-serif;
                  fill: #E4E3E3;
                }
                .event-count {
                  font-size: 18px;
                }
                .price {
                  font-size: 20px;
                }
              </style>
              <text x="65" y="540" class="event-info event-count">${eventCount}</text>
              <text x="150" y="540" class="event-info price">${price}</text>
            </svg>
          `, 'utf-8'),
          gravity: 'northwest',
        },
        {
          input: qrCodeBuffer,
          top: 660,
          left: 75,
        },
      ])
      .toBuffer();

    console.log('Ticket image generated successfully in memory.', name, phone, price, eventCount);
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};