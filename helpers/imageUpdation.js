import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';
import { generateQRCode } from './qrCodeGenerator.js';
import fs from 'fs/promises';

class TicketImageGenerator {
  constructor() {
    this.__filename = fileURLToPath(import.meta.url);
    this.__dirname = path.dirname(this.__filename);
    
    // Configuration constants
    this.CONFIG = {
      FONT_PATH: path.join(this.__dirname, 'fonts'),
      IMAGE_PATH: path.join(this.__dirname, '../images'),
      MAX_RETRIES: 3,
      TIMEOUT: 10000,
      CACHE_LIMIT: 10,
      MAX_NAME_LENGTH: 100,
      MAX_PHONE_LENGTH: 15
    };

    // Caches
    this.fontsRegistered = false;
    this.canvasInstance = null;
    this.imageCache = new Map();

    // Bind methods to ensure correct context
    this.initializeResources = this.initializeResources.bind(this);
    this.logError = this.logError.bind(this);
    this.validateAndSanitizeInput = this.validateAndSanitizeInput.bind(this);
  }

  // Improved error logging utility
  logError(message, context = {}) {
    console.error(JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
      ...context
    }, null, 2));
  }

  // Input validation and sanitization
  validateAndSanitizeInput(inputs) {
    const { participantId, name, phone, price, eventCount } = inputs;
    
    // Validation checks
    if (!participantId || !name || !phone || !price || !eventCount) {
      throw new Error('Missing required parameters for ticket image generation');
    }

    return {
      participantId,
      name: name.trim().substring(0, this.CONFIG.MAX_NAME_LENGTH),
      phone: phone.replace(/\D/g, '').substring(0, this.CONFIG.MAX_PHONE_LENGTH),
      price: String(price),
      eventCount: Number(eventCount)
    };
  }

  // Initialize fonts and canvas
  initializeResources() {
    if (this.fontsRegistered) return;

    registerFont(
      path.join(this.CONFIG.FONT_PATH, 'Montserrat-Regular.ttf'),
      { family: 'Montserrat' }
    );
    registerFont(
      path.join(this.CONFIG.FONT_PATH, 'Montserrat-Bold.ttf'),
      { family: 'Montserrat-Bold' }
    );

    this.canvasInstance = createCanvas(938, 3094);
    this.fontsRegistered = true;
  }

  // Enhanced text wrapping
  wrapText(context, text, x, y, maxWidth, lineHeight) {
    if (!text || typeof text !== 'string') {
      this.logError('Invalid text for wrapping', { text });
      return y;
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

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
  }

  // Generate text overlay
  generateTextImage(inputs) {
    const { name, phone, price, eventCount, participantId } = inputs;
    const context = this.canvasInstance.getContext('2d');
    
    context.clearRect(0, 0, this.canvasInstance.width, this.canvasInstance.height);
    
    const color = eventCount === 4 ? 'white' : 'black';
    context.fillStyle = 'white';
    const maxWidth = 700;
    const lineHeight = 50;

    // Text rendering logic
    context.font = '47px Montserrat';
    context.fillText('Name:', 48, 1580);
    context.font = 'bolder 47px Montserrat-Bold';
    const newY = this.wrapText(context, name, 250, 1580, maxWidth, lineHeight);

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

    return this.canvasInstance.toBuffer('image/png');
  }

  // Load and cache base image
  async getBaseImage(eventCount) {
    const cacheKey = `event_${eventCount}`;
    
    if (!this.imageCache.has(cacheKey)) {
      const imagePath = path.join(this.CONFIG.IMAGE_PATH, `${eventCount}.jpg`);
      
      try {
        const imageBuffer = await fs.readFile(imagePath);
        const image = sharp(imageBuffer);
        this.imageCache.set(cacheKey, image);
        
        // Limit cache size
        if (this.imageCache.size > this.CONFIG.CACHE_LIMIT) {
          const firstKey = this.imageCache.keys().next().value;
          this.imageCache.delete(firstKey);
        }
      } catch (error) {
        this.logError('Failed to load base image', {
          eventCount,
          imagePath,
          error: error.message
        });
        throw error;
      }
    }
    
    return this.imageCache.get(cacheKey);
  }

  // Fallback ticket generation
  async createFallbackTicket(inputs) {
    const { participantId, name, phone, price, eventCount } = inputs;
    
    try {
      const fallbackImage = sharp({
        create: {
          width: 938,
          height: 3094,
          channels: 4,
          background: { r: 240, g: 240, b: 240, alpha: 1 }
        }
      });

      const context = this.canvasInstance.getContext('2d');
      context.clearRect(0, 0, this.canvasInstance.width, this.canvasInstance.height);
      context.fillStyle = 'black';
      context.font = '40px Montserrat';
      
      context.fillText('Fallback Ticket', 100, 500);
      context.fillText(`Name: ${name}`, 100, 600);
      context.fillText(`Phone: ${phone}`, 100, 700);
      context.fillText(`Event Count: ${eventCount}`, 100, 800);
      context.fillText(`Participant ID: ${participantId}`, 100, 900);

      const fallbackTextBuffer = this.canvasInstance.toBuffer('image/png');

      return await fallbackImage
        .composite([{
          input: fallbackTextBuffer,
          top: 0,
          left: 0
        }])
        .png()
        .toBuffer();

    } catch (fallbackError) {
      this.logError('Critical error in fallback ticket creation', {
        error: fallbackError.message,
        participantId
      });
      throw fallbackError;
    }
  }

  // Main ticket image generation method
  async updateTicketImage(inputs) {
    // Validate and sanitize inputs
    const sanitizedInputs = this.validateAndSanitizeInput(inputs);
    const { participantId, name, phone, price, eventCount } = sanitizedInputs;

    let retryCount = 0;
    const MAX_RETRIES = this.CONFIG.MAX_RETRIES;

    while (retryCount < MAX_RETRIES) {
      try {
        // Initialize resources if not already done
        this.initializeResources();

        // Parallel processing with timeout
        const [baseImage, qrCodeBase64] = await Promise.race([
          Promise.all([
            this.getBaseImage(eventCount),
            generateQRCode(participantId, eventCount)
          ]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Ticket image generation timeout')), this.CONFIG.TIMEOUT)
          )
        ]);

        const qrCodeImage = Buffer.from(qrCodeBase64, 'base64');
        const textImageBuffer = this.generateTextImage(sanitizedInputs);

        // Verify QR code and text image buffers
        if (!qrCodeImage || !textImageBuffer) {
          throw new Error('Failed to generate QR code or text image');
        }

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
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();

        // Verify final image buffer
        if (!updatedImageBuffer || updatedImageBuffer.length === 0) {
          throw new Error('Generated image buffer is empty');
        }

        return updatedImageBuffer;

      } catch (error) {
        retryCount++;
        
        // Detailed error logging
        this.logError(`Ticket image generation attempt ${retryCount} failed`, {
          error: error.message,
          stack: error.stack,
          participantId,
          eventCount,
          retryCount
        });

        // Exponential backoff
        if (retryCount < MAX_RETRIES) {
          const backoffTime = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }

        // Last retry - fallback mechanism
        if (retryCount === MAX_RETRIES) {
          try {
            return await this.createFallbackTicket(sanitizedInputs);
          } catch (fallbackError) {
            this.logError('Critical: Fallback ticket creation failed', {
              error: fallbackError.message,
              originalError: error.message
            });
            
            throw new Error('Failed to generate ticket image after multiple attempts');
          }
        }
      }
    }

    throw new Error('Unexpected error in ticket image generation');
  }
}

// Export a singleton instance
export default new TicketImageGenerator();