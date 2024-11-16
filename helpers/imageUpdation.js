import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs/promises'; // Use to read local font files
import { generateQRCode } from './qrCodeGenerator.js';
import path from 'path';

const loadFontAsBase64 = async (fontPath) => {
  try {
    const absolutePath = path.resolve(__dirname, fontPath);
    const fontData = await fs.readFile(absolutePath);
    return `data:font/ttf;base64,${fontData.toString('base64')}`;
  } catch (error) {
    console.error(`Error loading font from path ${fontPath}:`, error);
    throw new Error('Failed to load font');
  }
};


// Generate an SVG string with embedded local fonts
const generateSVGText = async (name, phone, price, eventCount) => {
  const montserratFont = await loadFontAsBase64('./assets/fonts/Montserrat-Regular.ttf');
  const montserratBoldFont = await loadFontAsBase64('./assets/fonts/Montserrat-Bold.ttf');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="938" height="3090">
      <style>
        @font-face {
          font-family: 'Montserrat';
          src: url('${montserratFont}') format('truetype');
        }
        @font-face {
          font-family: 'Montserrat-Bold';
          src: url('${montserratBoldFont}') format('truetype');
        }
        .header { font-family: 'Montserrat-Bold'; font-size: 46px; fill: white; }
        .details { font-family: 'Montserrat'; font-size: 35px; fill: white; }
      </style>
      <rect width="100%" height="100%" fill="transparent" />
      <text x="35" y="1500" class="header">Name: ${name}</text>
      <text x="35" y="1550" class="header">Phone: ${phone}</text>
      <text x="122" y="1700" class="details">${eventCount}</text>
      <text x="340" y="1700" class="details">${price}</text>
    </svg>
  `;
};

// Main function to update ticket image
export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    const baseTicketUrl = `https://sambhram-tickets-bucket.s3.ap-south-1.amazonaws.com/${eventCount}.png`;

    // Fetch the base ticket image and generate the QR code in parallel
    const [response, qrCodeBase64, svgText] = await Promise.all([
      axios.get(baseTicketUrl, { responseType: 'arraybuffer' }),
      generateQRCode(participantId, eventCount),
      generateSVGText(name, phone, price, eventCount)
    ]);

    const baseTicketImageBuffer = Buffer.from(response.data, 'binary');
    const qrCodeImage = Buffer.from(qrCodeBase64, 'base64'); // Convert base64 string to buffer
    const svgBuffer = Buffer.from(svgText);

    // Composite the SVG and QR code images onto the base ticket image
    const updatedImageBuffer = await sharp(baseTicketImageBuffer)
      .composite([
        { input: svgBuffer, top: 0, left: 0 },
        { input: qrCodeImage, top: 2540, left: 250 } // Adjusted position for the new height
      ])
      .png()
      .toBuffer();

    return updatedImageBuffer;
  } catch (error) {
    console.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
