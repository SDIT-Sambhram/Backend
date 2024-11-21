import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { generateQRCode } from './qrCodeGenerator.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.FONTCONFIG_PATH = path.join(__dirname, './');

let fontsRegistered = false;
let canvasInstance = null;
const imageCache = new Map();

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
  logger.info('Resources initialized: Fonts and Canvas are ready.');
};

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

const generateTextImage = (name, phone, price, eventCount, participantId) => {
  try {
    const context = canvasInstance.getContext('2d');
    context.clearRect(0, 0, canvasInstance.width, canvasInstance.height);
    let color = 'black';

    if (eventCount === 4) {
      color = 'white';
    }
    context.fillStyle = 'white';
    const maxWidth = 700;
    const lineHeight = 50;

    context.font = '47px Montserrat';
    context.fillText('Name:', 48, 1580);
    context.font = 'bolder 47px Montserrat-Bold';
    const newY = wrapText(context, name, 250, 1580, maxWidth, lineHeight);

    context.font = '47px Montserrat';
    context.fillText('Phone:', 48, newY + 50);
    context.font = 'bolder 47px Montserrat-Bold';
    context.fillText(phone, 260, newY + 50);

    context.font = '47px Montserrat';
    context.fillText(`${eventCount}`, 205, 1975);
    context.fillText(`${price}`, 532, 1975);

    context.fillStyle = color;
    context.font = '44px Montserrat';
    context.fillText(`ID - ${participantId}`, 95, 3005);

    logger.info('Generated text overlay successfully.');
    return canvasInstance.toBuffer('image/png');
  } catch (error) {
    logger.error('Error generating text image:', error);
    throw new Error('Failed to generate text image');
  }
};

const getBaseImage = async (eventCount) => {
  try {
    const cacheKey = `event_${eventCount}`;

    if (!imageCache.has(cacheKey)) {
      const imagePath = path.join(__dirname, `../images/${eventCount}.jpg`);
      const imageBuffer = await fs.readFile(imagePath);
      const image = sharp(imageBuffer);
      imageCache.set(cacheKey, image);

      if (imageCache.size > 10) {
        const firstKey = imageCache.keys().next().value;
        imageCache.delete(firstKey);
      }
    }

    logger.info(`Loaded base image for ${eventCount} events from cache or disk.`);
    return imageCache.get(cacheKey);
  } catch (error) {
    logger.error(`Error loading base image for event count ${eventCount}:`, error);
    throw new Error('Failed to load base image');
  }
};

export const updateTicketImage = async (participantId, name, phone, price, eventCount) => {
  try {
    initializeResources();

    const [baseImage, qrCodeBase64] = await Promise.all([
      getBaseImage(eventCount),
      generateQRCode(participantId, eventCount)
    ]);

    const qrCodeImage = Buffer.from(qrCodeBase64, 'base64');
    const textImageBuffer = generateTextImage(name, phone, price, eventCount, participantId);

    const updatedImageBuffer = await baseImage.clone()
      .composite([
        { input: textImageBuffer, top: 0, left: 0 },
        { input: qrCodeImage, top: 2300, left: 170 }
      ])
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    logger.info('Ticket image updated successfully.');
    return updatedImageBuffer;

  } catch (error) {
    logger.error('Error updating ticket image:', error);
    throw new Error('Failed to update ticket image');
  }
};
