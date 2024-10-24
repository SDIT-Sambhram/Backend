import express from "express";
import {registerController} from "../controllers/authController.js"
import {qrVerification} from "../controllers/qrcodeVerificationController.js"


//router object
const router = express.Router();

//routing
//REGISTER || METHOD POST
router.post('/register', registerController);
router.get('/verify/:participantId/:eventId', qrVerification);


export default router;