import express from "express";
import {registerController,verifyAndRegisterParticipant} from "../controllers/authController.js"


//router object
const router = express.Router();

//routing
router.post('/payment', registerController);
router.post('/payment/verify', verifyAndRegisterParticipant);


export default router;