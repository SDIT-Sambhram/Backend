import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';
import { createCanvas } from 'canvas';

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

// Helper function to generate QR code image
const generateQRCodeImage = async (qrCodeBase64) => {
  const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');
  return sharp(qrCodeBuffer).resize(100, 100); // Resize QR code if needed
};

// Helper function to create a text overlay image using canvas
const generateTextImage = (name, phone, price, eventCount) => {
  const canvas = createCanvas(300, 825); // Adjust the canvas size to match the ticket size
  const ctx = canvas.getContext('2d');

  // Set font properties (ensure the font is available)
  ctx.font = '16px Arial'; // Use a commonly available font
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'top';

  // Render the text onto the canvas
  ctx.fillText(`Name: ${name}`, 15, 460);
  ctx.fillText(`Phone: ${phone}`, 15, 500);
  ctx.fillText(`Event Count: ${eventCount}`, 15, 530);
  ctx.fillText(`Price: ${price}`, 15, 560);

  // Convert the canvas to a buffer (PNG format)
  return canvas.toBuffer('image/png');
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

    // Generate text image using canvas
    const textImageBuffer = generateTextImage(name, phone, price, eventCount);

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
