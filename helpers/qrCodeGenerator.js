// Exported functions to generate QR code for the participant
import QRCode from "qrcode";

export const generateQRCode = async (participantId) => {
    const qrUrl = `http://localhost:8081/verify/${participantId}`;
    return await QRCode.toDataURL(qrUrl);
};
