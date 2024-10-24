// imageGenerator.js
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

// Function to create an e-ticket image with registration details
export const createRegistrationImage = async (participant, registrations) => {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Set background color
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Set font properties
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';

  // Add a header with the event name
  ctx.fillText('Registration E-Ticket', width / 2, 50);

  // Add a horizontal line below the header
  ctx.beginPath();
  ctx.moveTo(50, 70);
  ctx.lineTo(width - 50, 70);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // Add participant details to the image
  ctx.font = '18px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.fillText(`Name: ${participant.name}`, 50, 120);
  ctx.fillText(`USN: ${participant.usn}`, 50, 150);
  ctx.fillText(`Phone: ${participant.phone}`, 50, 180);
  ctx.fillText(`College: ${participant.college}`, 50, 210);

  // Add a horizontal line below the participant details
  ctx.beginPath();
  ctx.moveTo(50, 240);
  ctx.lineTo(width - 50, 240);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // Add Registrations
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('Registered Events', width / 2, 280);

  // Add a horizontal line below the registrations header
  ctx.beginPath();
  ctx.moveTo(50, 310);
  ctx.lineTo(width - 50, 310);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  let yPosition = 340;

  // Add QR codes to the image
  for (let registration of registrations) {
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Event ID: ${registration.event_id}`, 50, yPosition);
    ctx.fillText(`Event Name: ${registration.event_name}`, 50, yPosition + 30);

    const qrCodeImage = registration.qr_code.split(',')[1]; // Get the base64 part
    const buffer = Buffer.from(qrCodeImage, 'base64');
    const img = await loadImage(buffer);

    // Draw the QR code image
    ctx.drawImage(img, width - 150, yPosition - 10, 100, 100);
    yPosition += 120; // Adjust position for the next registration
  }

  // Add a footer with a message
  ctx.font = '18px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.fillText('Please present this e-ticket at the event entrance.', width / 2, height - 50);

  // Save the image to a file
  const imagePath = `./images/${participant.name.replace(/\s+/g, '_')}_registration.png`;
  const bufferImage = canvas.toBuffer('image/png');
  fs.writeFileSync(imagePath, bufferImage);

  return imagePath; // Return the path to the generated image
};