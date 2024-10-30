import { body } from 'express-validator';

export const validateInputs = [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('usn').isString().trim().notEmpty().withMessage('USN is required'),
    body('phone').isString().trim().notEmpty().withMessage('Phone is required'),
    body('college').isString().trim().notEmpty().withMessage('College is required'),
    body('registrations').isArray().withMessage('Registrations should be an array')
    .custom((arr) => arr.length > 0).withMessage('At least one registration is required'),
    body('amount').isNumeric().notEmpty().withMessage('Amount is required') 

];

