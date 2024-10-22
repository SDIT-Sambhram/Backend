import Participant from "../models/Participant.js";
// import Jwt from "jsonwebtoken";


export const registerController = async (request, response) => {
    try {
       const { name, usn, phone, college, registrations } = request.body;
 
       // Perform validation checks
       if (!name || !usn || !phone || !college || !registrations) {
          return response.status(400).send({ message: 'All fields are required' });
       }
 
       // Create a new participant
       const user = await new Participant({
          name,
          usn,
          phone,
          college,
          registrations
       }).save();
 
       // Return success response
       return response.status(201).send({
          success: true,
          message: 'User registered successfully',
          user
       });
 
    } catch (error) {
       console.error(error);
       return response.status(500).send({
          success: false,
          message: 'Error in registration',
          error: error.message
       });
    }
 };