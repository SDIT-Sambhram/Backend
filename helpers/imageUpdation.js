import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { generateQRCode } from './qrCodeGenerator.js';
import fs from 'fs/promises';  // Using promise-based fs

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set the FONTCONFIG_PATH environment variable to the helpers directory
process.env.FONTCONFIG_PATH = path.join(__dirname, './');

// Cache for fonts registration
let fontsRegistered = false;

// Cache for canvas instance
let canvasInstance = null;

// Cache for base ticket images
const imageCache = new Map();

// Initialize fonts and canvas once
const initializeResources = () => {
  if (fontsRegistered) return;

  registerFont(
    path.join(__dirname, 'fonts', 'Montserrat-Regular.ttf'),
    { family: 'Montserrat' }
  );
  registerFont(
    path.join(__dirname, 'fonts', 'Montserrat-Bold.ttf'),
    { family: 'Montserrat-Bold' }
  );

  canvasInstance = createCanvas(938, 3094);
  fontsRegistered = true;
};

// Optimized text wrapping with pre-calculated metrics
const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = context.measureText(`${currentLine} ${word}`).width;
    
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  let lineY = y;
  for (const line of lines) {
    context.fillText(line, x, lineY);
    lineY += lineHeight;
  }
  
  return lineY;
};

// Generate text overlay with reused canvas
const generateTextImage = (name, phone, price, eventCount, participantId) => {
  const context = canvasInstance.getContext('2d');
  
  // Clear previous content
  context.clearRect(0, 0, canvasInstance.width, canvasInstance.height);
  let color = 'black';

  if (eventCount === 4) {
    color = 'white';
  }
  context.fillStyle = color;
  const maxWidth = 900;
  const lineHeight = 50;

  // Draw name
  context.font = '47px Montserrat';
  context.fillText('Name:', 48, 1580);
  context.font = 'bolder 47px Montserrat-Bold';
  const newY = wrapText(context, name, 250, 1580, maxWidth, lineHeight);

  // Draw phone
  context.font = '47px Montserrat';
  context.fillText('Phone:', 48, newY + 50);
  context.font = 'bolder 47px Montserrat-Bold';
  context.fillText(phone, 260, newY + 50);

  // Draw event count and price
  context.font = '47px Montserrat';
  context.fillText(`${eventCount}`, 205, 1975);
  context.fillText(`${price}`, 532, 1975);

  context.font = '40px Montserrat';
  context.fillText(`ID - ${participantId}`, 150, 3005);


  return canvasInstance.toBuffer('image/png');
};

// Load and cache base image
const getBaseImage = async (eventCount) => {
  const cacheKey = `event_${eventCount}`;
  
  if (!imageCache.has(cacheKey)) {
    const imagePath = path.join(__dirname, `../images/${eventCount}.jpg`);
    const imageBuffer = await fs.readFile(imagePath);
    const image = sharp(imageBuffer);
    imageCache.set(cacheKey, image);
    
    // Limit cache size
    if (imageCache.size > 10) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
  }
  
  return imageCache.get(cacheKey);
};

export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    // Initialize resources if not already done
    initializeResources();

    // Parallel processing for independent operations
    const [baseImage, qrCodeBase64] = await Promise.all([
      getBaseImage(eventCount),
      generateQRCode(participantId, eventCount)
    ]);

    const qrCodeImage = Buffer.from(qrCodeBase64, 'base64');
    const textImageBuffer = generateTextImage(name, phone, price, eventCount, participantId);

    // Process image with sharp pipeline
    const updatedImageBuffer = await baseImage.clone()
      .composite([
        {
          input: textImageBuffer,
          top: 0,
          left: 0
        },
        {
          input: qrCodeImage,
          top: 2300,
          left: 170
        }
      ])
      .jpeg({ quality: 85, mozjpeg: true }) // Optimize JPEG compression
      .toBuffer();

    return updatedImageBuffer;

  } catch (error) {
    console.error('Error updating ticket image:', error.message);
    throw new Error('Failed to update ticket image');
  }
};