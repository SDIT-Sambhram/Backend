import path from 'path';
import fs from 'fs';
import {Jimp} from 'jimp';
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
    const baseTicketImage = await Jimp.read(baseTicketPath);

    // Load the QR code image
    const qrCodeImage = await Jimp.read(qrCodeBuffer);

    // Load a font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

    // Add participant details to the image
    baseTicketImage.print(font, 15, 460, `Name: ${name}`);
    baseTicketImage.print(font, 15, 500, `Phone: ${phone}`);
    baseTicketImage.print(font, 65, 540, `${eventCount}`);
    baseTicketImage.print(font, 150, 540, `${price}`);

    // Composite the QR code onto the base image
    baseTicketImage.composite(qrCodeImage, 75, 660);

    // Get the updated image buffer
    const updatedImageBuffer = await baseTicketImage.getBufferAsync(Jimp.MIME_PNG);

    console.log('Ticket image generated successfully in memory.', name, phone, price, eventCount);
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};