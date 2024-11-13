import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas'; // Import node-canvas

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

    // Create a canvas to render text
    const canvas = createCanvas(300, 825); // Adjust the canvas size
    const ctx = canvas.getContext('2d');

    // Set font properties (make sure the font is available)
    ctx.font = '16px Arial'; // Use a widely available font
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'top';

    // Render text onto the canvas
    ctx.fillText(`Name: ${name}`, 15, 460);
    ctx.fillText(`Phone: ${phone}`, 15, 500);
    ctx.fillText(`Event Count: ${eventCount}`, 15, 530);
    ctx.fillText(`Price: ${price}`, 15, 560);

    // Convert canvas to buffer (PNG format)
    const textImageBuffer = canvas.toBuffer('image/png');

    // Resize and composite the QR code onto the base image
    const qrCodeImage = sharp(qrCodeBuffer).resize(100, 100); // Resize QR code if needed

    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImageBuffer, top: 0, left: 0 },  // Position text overlay
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


