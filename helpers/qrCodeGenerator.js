import QRCode from "qrcode";

export const generateQRCode = async (participantId) => {
  try {
    const qrUrl = `http://localhost:8081/verify/${participantId}`;
    
    // Generate QR code with white color for visibility as a base64 string
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      color: {
        dark: '#FFFFFF',    // White QR code color for high visibility
        light: '#00000000'  // Transparent background
      },
      margin: 1,
      width: 300  // Adjust width to increase the QR code size, if needed
    });

    // Remove the "data:image/png;base64," prefix and return only the base64 string
    const base64Image = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    return base64Image;

  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
};
