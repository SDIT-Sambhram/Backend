import express from "express";
import { registerParticipant } from "../controllers/registrationController.js";
import getAllEventDetails, { preloadCache } from "../controllers/eventController.js";
import { razorpayWebhook } from "../controllers/webhookController.js";
import { verifyTicket } from "../controllers/verifyQrcode.js";
//router object
const router = express.Router();

//routing
// Event routes
router.get('/events', getAllEventDetails);  // Get all events with caching

// Payment routes
router.post('/payment', registerParticipant);
router.post('/payment/webhook', express.json({ 
    verify: (req, res, buf) => { req.rawBody = buf; } 
}), razorpayWebhook);

// Note: Your ticket route is incomplete
router.post('/verify/ticket', verifyTicket);

// Preload the events cache when the server starts
preloadCache();

export default router;