import express from "express";
import {registerController,verifyAndRegisterParticipant} from "../controllers/registrationController.js";
import getAllEventDetails from "../controllers/eventController.js";


//router object
const router = express.Router();

//routing
router.post('/payment', registerController);
router.post('/payment/verify', verifyAndRegisterParticipant);
router.get('/events', getAllEventDetails);



export default router;