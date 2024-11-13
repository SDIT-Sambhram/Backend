import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';
import { createCanvas, loadImage, registerFont } from 'canvas';

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

// Load and register Montserrat font for Canvas
const loadMontserratFont = async () => {
  const fontPath = path.join(__dirname, '../fonts/Montserrat-Regular.ttf');
  registerFont(fontPath, { family: 'Montserrat' });
};

// Helper function to generate QR code image
const generateQRCodeImage = async (qrCodeBase64) => {
  const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');
  return sharp(qrCodeBuffer);
};

// Helper function to generate text overlay image with Canvas
const generateTextImage = async (name, phone, price, eventCount) => {
  const width = 300;
  const height = 825;
  
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  
  // Set background color (optional)
  context.fillStyle = 'black';
  context.fillRect(0, 0, width, height);
  
  // Set text properties
  context.fillStyle = 'white';
  context.font = '16px Montserrat';

  // Draw text on the canvas
  context.fillText(`Name: ${name}`, 10, 30);
  context.fillText(`Phone: ${phone}`, 10, 60);
  context.fillText(`Event Count: ${eventCount}`, 10, 90);
  context.fillText(`Price: ${price}`, 10, 120);
  
  // Convert canvas to PNG buffer
  return canvas.toBuffer();
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    // Load Montserrat font for Canvas
    await loadMontserratFont();

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

    // Load the base ticket image using Sharp
    const baseTicketImage = sharp(baseTicketPath);

    // Generate text image with Canvas as overlay
    const textImageBuffer = await generateTextImage(name, phone, price, eventCount);

    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImageBuffer, top: 0, left: 0 }, // Position text overlay
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
