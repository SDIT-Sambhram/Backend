import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';

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
  return sharp(qrCodeBuffer).resize(250, 250); // Resize the QR code for a better fit
};

// Helper function to generate text overlay image using custom font
const generateTextImage = async (name, phone, price, eventCount) => {
  const width = 300;
  const height = 825;
  
  // Register the custom font (from Lambda's file system)
  const fontPath = path.join(__dirname, 'assets', 'fonts', 'Montserrat-Regular.ttf');
  registerFont(fontPath, { family: 'Montserrat' });
  
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  
  // Set text properties using the custom font
  context.fillStyle = 'white';
  context.font = '18px Montserrat'; // Use the custom Montserrat font

  // Draw text on the canvas
  context.fillText(`Name: ${name}`, 15, 4300);
  context.fillText(`Phone: ${phone}`, 15, 460);
  context.fillText(`${eventCount}`, 56, 500);
  context.fillText(`${price}`, 150, 500);
  
  // Convert canvas to PNG buffer (transparent background)
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

    // Load the base ticket image using Sharp (ensure transparency is preserved)
    const baseTicketImage = sharp(baseTicketPath);

    // Generate text image as overlay
    const textImageBuffer = await generateTextImage(name, phone, price, eventCount);

    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImageBuffer, top: 0, left: 0 }, // Position text overlay
        { input: await qrCodeImage.toBuffer(), top: 660, left: 75 } // Position QR code
      ])
      .png() // Ensure output is PNG (supports transparency)
      .toBuffer();

    console.log('Ticket image generated successfully in memory.', name, phone, price, eventCount);
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
