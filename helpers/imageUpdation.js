import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to update ticket image with participant details
export const updateTicketImage = async (name, phone, qr_code) => {
  const baseTicketPath = path.join(__dirname, '../images/tickets/1.png');

  // Generate the QR code buffer
  const qrCodeBuffer = await QRCode.toBuffer(qr_code);

  // Overlay text and QR code on the image
  const updatedImageBuffer = await sharp(baseTicketPath)
    .resize(800, 600)  // Adjust dimensions as needed
    .composite([
      {
        input: Buffer.from(`
          <svg width="800" height="600">
            <style>
              .name { font-size: 24px; fill: #000000; }
              .phone { font-size: 24px; fill: #000000; }
            </style>
            <text x="50" y="50" class="name">Name: ${name}</text>
            <text x="50" y="100" class="phone">Phone: ${phone}</text>
          </svg>
        `),
        gravity: 'northwest',
      },
      {
        input: qrCodeBuffer,
        top: 300,
        left: 600,
      },
    ])
    .toBuffer();

  return updatedImageBuffer;
};
