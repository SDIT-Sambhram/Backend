import express from 'express';
import { adminLogin, createParticipant, getAllParticipants } from '../Admin/adminController.js';
import { protect, isAdmin } from '../middlewares/auth.js';

const adminRouter = express.Router();



adminRouter.post('/admin-login', adminLogin);
adminRouter.post('/Create-participants', protect, isAdmin, createParticipant);
adminRouter.get('/participants', protect, isAdmin, getAllParticipants);



export default adminRouter;