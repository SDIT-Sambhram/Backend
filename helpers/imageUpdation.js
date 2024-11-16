import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pkg from '@napi-rs/canvas';
import { generateQRCode } from './qrCodeGenerator.js';
import axios from 'axios';

const { createCanvas, GlobalFonts } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Modified wrapText function to return the ending Y position
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
  return lineY + lineHeight;  // Return new Y position after the last line
};

// Function to create a text image overlay
const generateTextImage = async (name, phone, price, eventCount) => {
  try {
    const width = 938;
    const height = 3090;
    const fontPath1 = path.join(__dirname, 'assets', 'fonts', 'Montserrat-Regular.ttf');
    GlobalFonts.registerFromPath(fontPath1, 'Montserrat');

    const fontPath2 = path.join(__dirname, 'assets', 'fonts', 'Montserrat-Bold.ttf');
    GlobalFonts.registerFromPath(fontPath2, 'Montserrat-Bold');

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';

    const maxWidth = 900;
    const lineHeight = 40;

    // Draw the name and get the new Y position for the next line
    context.font = 'bolder 36px Montserrat-Bold';
    const newY = wrapText(context, `Name: ${name}`, 35, 1500, maxWidth, lineHeight);

    // Draw the phone number below the wrapped name text
    context.font = 'bolder 36px Montserrat-Bold';
    context.fillText(`Phone: ${phone}`, 35, newY + 40);

    // Draw event count and price at fixed positions
    context.font = '32px Montserrat';
    context.fillText(`${eventCount}`, 122, 1700);
    context.fillText(`${price}`, 340, 1700);

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error generating text image:', error);
    throw new Error('Failed to generate text image');
  }
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    const baseTicketUrl = `https://sambhram-tickets-bucket.s3.ap-south-1.amazonaws.com/${eventCount}.png`;
    
    // Fetch the base ticket image from the URL
    const response = await axios.get(baseTicketUrl, { responseType: 'arraybuffer' });
    const baseTicketImageBuffer = Buffer.from(response.data, 'binary');
    console.log('Base ticket image fetched successfully');

    const qrCodeBase64 = await generateQRCode(participantId, eventCount);
    const qrCodeImage = Buffer.from(qrCodeBase64, 'base64');  // Convert base64 string to buffer
    console.log('QR code generated successfully');

    const baseTicketImage = sharp(baseTicketImageBuffer);
    const textImageBuffer = await generateTextImage(name, phone, price, eventCount);
    console.log('Text image generated successfully');

    const updatedImageBuffer = await baseTicketImage
      .composite([
        { input: textImageBuffer, top: 0, left: 0 },
        { input: qrCodeImage, top: 2540, left: 250 }  // Adjusted position for the new height
      ])
      .png()
      .toBuffer();

    console.log('Ticket image updated successfully');
    return updatedImageBuffer;
  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};