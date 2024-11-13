import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to check if a file exists
const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

// Helper function to generate SVG text
const generateSVGText = (name, phone, price, eventCount) => {
  return `
    <svg width="300" height="825">
      <text x="15" y="460" font-family="Arial" font-size="16" fill="white">Name: ${name}</text>
      <text x="15" y="500" font-family="Arial" font-size="16" fill="white">Phone: ${phone}</text>
      <text x="15" y="540" font-family="Arial" font-size="16" fill="white">Event Count: ${eventCount}</text>
      <text x="15" y="580" font-family="Arial" font-size="16" fill="white">Price: ${price}</text>
    </svg>
  `;
};

// Helper function to resize QR code
const generateQRCodeImage = async (qrCodeBase64) => {
  const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');
  return sharp(qrCodeBuffer).resize(100, 100); // Resize QR code if needed
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    // Path to the base ticket image
    const baseTicketPath = path.join(__dirname, `../images/tickets/${eventCount}.png`);
    console.log('Base ticket path:', baseTicketPath);

    // Check if base ticket image exists
    const ticketExists = await fileExists(baseTicketPath);
    if (!ticketExists) {
      throw new Error('Base ticket image not found at the specified path');
    }
    console.log('Base ticket image exists.');

    // Generate QR code
    const qrCodeBase64 = await generateQRCode(participantId);
    const qrCodeImage = await generateQRCodeImage(qrCodeBase64);
    console.log('QR code generated successfully.');

    // Load the base ticket image using sharp
    const baseTicketImage = sharp(baseTicketPath);

    // Generate SVG text buffer
    const svgText = generateSVGText(name, phone, price, eventCount);
    const textImageBuffer = Buffer.from(svgText);
    
    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImageBuffer, top: 0, left: 0 },  // Position text overlay
        { input: await qrCodeImage.toBuffer(), top: 660, left: 75 }  // Position QR code
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
