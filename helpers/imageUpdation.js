import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';
import { createCanvas, loadImage } from '@napi-rs/canvas';

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

    // Create a canvas for adding text (using @napi-rs/canvas)
    const canvas = createCanvas(500, 700); // Adjust size based on your ticket image
    const context = canvas.getContext('2d');

    // Set text styling
    context.fillStyle = '#FFFFFF'; // White color for text
    context.font = '16px Sans';

    // Add participant details to the canvas
    context.fillText(`Name: ${name}`, 15, 460);
    context.fillText(`Phone: ${phone}`, 15, 500);
    context.fillText(`${eventCount}`, 65, 540);
    context.fillText(`${price}`, 150, 540);

    // Render the text as an image buffer
    const textOverlay = canvas.toBuffer('image/png');

    // Composite the QR code onto the base image
    const qrCodeImage = sharp(qrCodeBuffer).resize(100, 100); // Resize QR code if needed

    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textOverlay, top: 0, left: 0 },        // Position text overlay
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

