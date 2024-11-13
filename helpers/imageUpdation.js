import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateQRCode } from '../helpers/qrCodeGenerator.js';
import sharp from 'sharp';

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

// Helper function to load Montserrat font base64 from a file
const loadMontserratFont = async () => {
  const fontPath = path.join(__dirname, '..\fonts\montserrat-base64.txt'); // Path to the font file
  const fontBase64 = await fs.promises.readFile(fontPath, 'utf8');
  return `data:font/ttf;base64,${fontBase64}`;
};

// Helper function to generate QR code image
const generateQRCodeImage = async (qrCodeBase64) => {
  const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');
  return sharp(qrCodeBuffer);
};

// Helper function to generate text overlay image with Montserrat font
const generateTextImage = async (name, phone, price, eventCount, montserratFontBase64) => {
  const svgText = `
    <svg width="300" height="875">
      <defs>
        <style type="text/css">
          @font-face {
            font-family: 'Montserrat';
            src: url('${montserratFontBase64}') format('truetype');
          }
          .title { fill: white; font-size: 16px; font-family: 'Montserrat'; }
        </style>
      </defs>
      <text x="10" y="30" class="title">Name: ${name}</text>
      <text x="10" y="60" class="title">Phone: ${phone}</text>
      <text x="10" y="90" class="title">Event Count: ${eventCount}</text>
      <text x="10" y="120" class="title">Price: ${price}</text>
    </svg>`;
  const svgBuffer = Buffer.from(svgText);
  return sharp(svgBuffer).resize(300, 875).png();
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    // Load Montserrat font base64 from the file
    const montserratFontBase64 = await loadMontserratFont();

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

    // Generate text image with Montserrat font as overlay
    const textImage = await generateTextImage(name, phone, price, eventCount, montserratFontBase64);

    // Composite the text and QR code onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: await textImage.toBuffer(), top: 0, left: 0 }, // Position text overlay
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
