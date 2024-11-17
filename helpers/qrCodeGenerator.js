import QRCode from "qrcode";

export const generateQRCode = async (participantId, eventCount) => {
  try {
    const qrUrl = `https://shreedevisambhram.in/verify?id=${participantId}`;
    let color = '#000401';
    if (eventCount === 4) {
      color = '#F5F5F5';
    }

    // Generate QR code with white color for visibility as a base64 string
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      color: {
        dark: color,    // QR code color for high visibility
        light: '#00000000'  // Transparent background
      },
      margin: 1,
      width: 600  // Adjust width to increase the QR code size, if needed
    });

    // Remove the "data:image/png;base64," prefix and return only the base64 string
    const base64Image = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    return base64Image;

  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
};