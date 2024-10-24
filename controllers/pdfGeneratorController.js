// pdfGenerator.js
import PDFDocument from 'pdfkit';
import fs from 'fs';

// Function to create a PDF document
export const createRegistrationPDF = async (participant, registrations) => {
    const doc = new PDFDocument();
    const pdfPath = `./pdfs/${participant.name.replace(/\s+/g, '_')}_registration.pdf`; // Path to save the PDF
    
    // Pipe the PDF into a writable stream
    doc.pipe(fs.createWriteStream(pdfPath));
    
    // Add participant details to the PDF
    doc.fontSize(20).text(`Registration Details for ${participant.name}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`USN: ${participant.usn}`);
    doc.text(`Phone: ${participant.phone}`);
    doc.text(`College: ${participant.college}`);
    doc.moveDown();
    doc.text('Registrations:');

    // Add QR codes to the PDF
    for (let registration of registrations) {
        doc.moveDown(8);
        doc.text(`Event ID: ${registration.event_id}`);
        
        // Add QR code image to the PDF
        const qrCodeImage = registration.qr_code.split(',')[1]; // Get the base64 part
        const buffer = Buffer.from(qrCodeImage, 'base64');
        doc.image(buffer, { width: 100, align: 'center' });
    }

    // Finalize the PDF and end the stream
    doc.end();

    return pdfPath; // Return the path to the generated PDF
};
