import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { generateQRCode } from './qrCodeGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to wrap text within a specified width and return new Y position
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
  return lineY + lineHeight; // Return new Y position after the last line
};

// Function to create a text image overlay
const generateTextImage = async (name, phone, price, eventCount) => {
  const width = 600;  // Use larger canvas size
  const height = 1650;  // Use larger canvas size
  
  const fontPath1 = path.join(__dirname, 'assets', 'fonts', 'Montserrat-Regular.ttf');
  registerFont(fontPath1, { family: 'Montserrat' });

  const fontPath2 = path.join(__dirname, 'assets', 'fonts', 'Montserrat-Bold.ttf');
  registerFont(fontPath2, { family: 'Montserrat-Bold' });

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';

  const maxWidth = 560;
  const lineHeight = 40;

  // Draw the name and get the new Y position for the next line
  context.font = 'bolder 36px Montserrat-Bold';  // Increase font size for sharpness
  const newY = wrapText(context, `Name: ${name}`, 32, 830, maxWidth, lineHeight);

  // Draw the phone number below the wrapped name text
  context.font = 'bolder 36px Montserrat-Bold';
  context.fillText(`Phone: ${phone}`, 32, newY + 20);

  // Draw event count and price at fixed positions
  context.font = '32px Montserrat';
  context.fillText(`${eventCount}`, 122, 1070);
  context.fillText(`${price}`, 340, 1070);

  return canvas.toBuffer('image/png');
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    const baseTicketPath = path.join(__dirname, `../images/tickets/${eventCount}.png`);
    if (!fs.existsSync(baseTicketPath)) {
      throw new Error('Base ticket image not found');
    }

    // Generate the QR code at high resolution
    const qrCodeBase64 = await generateQRCode(participantId, eventCount);
    const qrCodeImage = Buffer.from(qrCodeBase64, 'base64');  // Convert base64 string to buffer

    const baseTicketImage = sharp(baseTicketPath);
    const textImageBuffer = await generateTextImage(name, phone, price, eventCount);

    // Resize both the text and QR code images to match the base image size
    const resizedTextImageBuffer = await sharp(textImageBuffer)
      .resize(300, 825)  // Resize to the base image dimensions
      .toBuffer();

    const resizedQRCodeImage = await sharp(qrCodeImage)
      .resize(150, 150)  // Resize QR code to fit in the image
      .toBuffer();

    // Now composite the resized images onto the base ticket image
    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: resizedTextImageBuffer, top: 0, left: 0 },
        { input: resizedQRCodeImage, top: 635, left: 63 }  // Adjust QR code position as needed
      ])
      .png()
      .toBuffer();

    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
