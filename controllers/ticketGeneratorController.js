// imageGenerator.js
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

// Function to create an image with registration details
export const createRegistrationImage = async (participant, registrations) => {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Set font properties
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    
    // Add participant details to the image
    ctx.fillText(`Registration Details for ${participant.name}`, width / 2, 30);
    ctx.font = '14px Arial';
    ctx.fillText(`USN: ${participant.usn}`, width / 2, 60);
    ctx.fillText(`Phone: ${participant.phone}`, width / 2, 80);
    ctx.fillText(`College: ${participant.college}`, width / 2, 100);
    
    // Add Registrations
    ctx.fillText('Registrations:', width / 2, 130);
    let yPosition = 160;

    // Add QR codes to the image
    for (let registration of registrations) {
        ctx.fillText(`Event ID: ${registration.event_id}`, width / 2, yPosition);
        const qrCodeImage = registration.qr_code.split(',')[1]; // Get the base64 part
        const buffer = Buffer.from(qrCodeImage, 'base64');
        const img = await loadImage(buffer);
        
        // Draw the QR code image
        ctx.drawImage(img, (width - 100) / 2, yPosition + 10, 100, 100);
        yPosition += 120; // Adjust position for the next registration
    }

    // Save the image to a file
    const imagePath = `./images/${participant.name.replace(/\s+/g, '_')}_registration.png`;
    const bufferImage = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, bufferImage);

    return imagePath; // Return the path to the generated image
};
