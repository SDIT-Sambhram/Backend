import QRCode from "qrcode";

export const generateQRCode = async (participantId) => {
  try {
    const qrUrl = `http://localhost:8081/verify/${participantId}`;
    
    // Generate QR code with transparent background as a base64 string
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      color: {
        dark: '#000000',    // Black QR code color
        light: '#00000000'  // Transparent background
      },
      margin: 1
    });

    // Remove the "data:image/png;base64," prefix and return only the base64 string
    const base64Image = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    return base64Image;

  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
};
