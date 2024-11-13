import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';

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
    console.log('QR code generated successfully.');

    // Ensure the base ticket image exists
    const ticketExists = await fs.promises.access(baseTicketPath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }
    console.log('Base ticket image exists.');

    // Load the base ticket image using sharp
    let baseTicketImage = sharp(baseTicketPath);

    // Create an image with text for the participant details
    const textImage = await sharp({
      create: {
        width: 300, // Set width of the text area (adjust based on your ticket size)
        height: 825, // Set height of the text area (adjust based on your ticket size)
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      }
    })
      .composite([{
        input: Buffer.from(`
          <svg width="300" height="825">
            <text x="15" y="460" font-family="Sans" font-size="16" fill="white">${name}</text>
            <text x="15" y="500" font-family="Sans" font-size="16" fill="white">${phone}</text>
            <text x="15" y="530" font-family="Sans" font-size="16" fill="white">Event Count: ${eventCount}</text>
            <text x="15" y="560" font-family="Sans" font-size="16" fill="white">Price: ${price}</text>
          </svg>
        `),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();

    // Resize and composite the QR code onto the base image
    const qrCodeImage = sharp(qrCodeBuffer).resize(100, 100); // Resize QR code if needed

    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImage, top: 0, left: 0 },        // Position text overlay
        { input: await qrCodeImage.toBuffer(), top: 660, left: 75 } // Position QR code
      ])
      .png()
      .toBuffer();

    console.log('Ticket image generated successfully in memory.', name, phone, price, eventCount);
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
