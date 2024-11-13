import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';

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
  const Jimp = await import('jimp'); // Import Jimp
  const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');
  return await Jimp.read(qrCodeBuffer); // Returns a Jimp image object
};

// Helper function to generate text overlay image using Jimp
const generateTextImage = async (name, phone, price, eventCount) => {
  const Jimp = await import('jimp'); // Import Jimp
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE); // Load a white font (16px size)

  const canvasWidth = 300;
  const canvasHeight = 875;

  // Create a blank image with transparent background
  const image = new Jimp(canvasWidth, canvasHeight, 0x00000000); // Transparent background

  // Overlay text
  image.print(font, 10, 10, `Name: ${name}`);
  image.print(font, 10, 40, `Phone: ${phone}`);
  image.print(font, 10, 70, `Event Count: ${eventCount}`);
  image.print(font, 10, 100, `Price: ${price}`);

  return image;
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    const Jimp = await import('jimp'); // Import Jimp

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

    // Load the base ticket image using Jimp
    const baseTicketImage = await Jimp.read(baseTicketPath);

    // Generate text image using Jimp
    const textImage = await generateTextImage(name, phone, price, eventCount);

    // Composite the text and QR code onto the base ticket image
    baseTicketImage.composite(textImage, 0, 0); // Composite text onto the image (top-left corner)
    baseTicketImage.composite(qrCodeImage, 75, 660); // Position QR code

    // Write the final image to buffer (you can save it as a file if needed)
    const updatedImageBuffer = await baseTicketImage.getBufferAsync(Jimp.MIME_PNG);

    console.log('Ticket image generated successfully in memory.', name, phone, price, eventCount);
    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
