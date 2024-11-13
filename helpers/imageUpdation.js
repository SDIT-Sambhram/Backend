import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { generateQRCode } from './qrCodeGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to wrap text within a specified width
const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
  const words = text.split(' ');
  let line = '';
  let lineY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, lineY);
      line = words[n] + ' ';
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, lineY);
};

// Function to create a text image overlay
const generateTextImage = async (name, phone, price, eventCount) => {
  const width = 300;
  const height = 825;
  const fontPath = path.join(__dirname, 'assets', 'fonts', 'Montserrat-Regular.ttf');
  registerFont(fontPath, { family: 'Montserrat' });

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.font = '17px Montserrat';

  const maxWidth = 280;
  const lineHeight = 25;

  wrapText(context, `Name: ${name}`, 16, 435, maxWidth, lineHeight);
  context.fillText(`Phone: ${phone}`, 16, 470);
  context.fillText(`${eventCount}`, 61, 535);
  context.fillText(`${price}`, 170, 535);

  return canvas.toBuffer('image/png');
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    const baseTicketPath = path.join(__dirname, `../images/tickets/${eventCount}.png`);
    if (!fs.existsSync(baseTicketPath)) {
      throw new Error('Base ticket image not found');
    }

    const qrCodeBase64 = await generateQRCode(participantId, eventCount);
    const qrCodeImage = Buffer.from(qrCodeBase64, 'base64');  // Convert base64 string to buffer

    const baseTicketImage = sharp(baseTicketPath);
    const textImageBuffer = await generateTextImage(name, phone, price, eventCount);

    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImageBuffer, top: 0, left: 0 },
        { input: qrCodeImage, top: 630, left: 60 }
      ])
      .png()
      .toBuffer();

    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
