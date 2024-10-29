export const body = jest.fn(() => ({
    isString: jest.fn(() => ({
        trim: jest.fn(() => ({
            notEmpty: jest.fn(() => ({
                withMessage: jest.fn(() => true), // Simulates success for string validation
            })),
        })),
    })),
    isArray: jest.fn(() => ({
        withMessage: jest.fn(() => ({
            custom: jest.fn(() => ({
                withMessage: jest.fn(() => true), // Simulates success for array validation with custom
            })),
        })),
    })),
    isNumeric: jest.fn(() => ({
        notEmpty: jest.fn(() => ({
            withMessage: jest.fn(() => true), // Simulates success for numeric validation
        })),
    })),
}));

export const validationResult = jest.fn(() => ({
    isEmpty: jest.fn(() => true), // Change this to `false` in tests for validation errors
    array: jest.fn(() => []), // Provide error objects in this array as needed for tests
}));
