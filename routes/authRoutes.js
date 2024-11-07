import express from "express";
import { registerParticipant } from "../controllers/registrationController.js";
import getAllEventDetails from "../controllers/eventController.js";
import { razorpayWebhook } from "../controllers/webhookController.js";

//router object
const router = express.Router();

//routing
router.post('/payment', registerParticipant);
router.post('/payment/webhook', express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), razorpayWebhook);
router.get('/events', getAllEventDetails);
router.get('/ticket', );

export default router;