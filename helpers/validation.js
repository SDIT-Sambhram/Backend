import { body } from 'express-validator';

export const validateInputs = [
    // Validate 'name' field
    body('name')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 3 })
        .withMessage('Name must be at least 3 characters long')
        .escape(),

    // Validate 'usn' field
    body('usn')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('USN is required')
        .isLength({ min: 4 })
        .withMessage('USN must be at least 4 characters long'),

    // Validate 'phone' field
    body('phone')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Phone is required')
        .matches(/^\d{10}$/)
        .withMessage('Phone must be a 10-digit number'),

    // Validate 'college' field
    body('college')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('College is required')
        .escape(),

    // Validate 'registrations' field
    body('registrations')
        .isArray()
        .withMessage('Registrations should be an array')
        .custom((arr) => arr.length > 0)
        .withMessage('At least one registration is required')
        .custom((arr) => arr.length <= 4)
        .withMessage('Registrations cannot exceed 4 items')
        .custom((arr) =>
            arr.every((item) => item.event_id && typeof item.event_id === 'string')
        )
        .withMessage('Each registration must have a valid event_id'),
];
