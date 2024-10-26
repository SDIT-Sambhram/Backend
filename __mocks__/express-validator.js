export const body = jest.fn(() => ({
    isString: jest.fn(() => ({
        trim: jest.fn(() => ({
            notEmpty: jest.fn(() => ({
                withMessage: jest.fn(() => true), // Mock success
            })),
        })),
    })),
    isArray: jest.fn(() => ({
        notEmpty: jest.fn(() => ({
            withMessage: jest.fn(() => true), // Mock success
        })),
    })),
    isNumeric: jest.fn(() => ({
        notEmpty: jest.fn(() => ({
            withMessage: jest.fn(() => true), // Mock success
        })),
    })),
}));

export const validationResult = jest.fn(() => ({
    isEmpty: jest.fn(() => true), // Change this in tests as needed
    array: jest.fn(() => []), // Example for errors
}));
