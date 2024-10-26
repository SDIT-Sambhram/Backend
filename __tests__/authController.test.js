import mongoose from 'mongoose';
import { registerController, verifyAndRegisterParticipant } from '../controllers/registrationController';
import Participant from '../models/Participant';
import { createOrder, verifyPayment } from '../controllers/paymentController';
import { generateQRCode } from '../helpers/qrCodeGenerator';
import { validationResult } from 'express-validator';

// Mocking dependencies
jest.mock('../models/Participant');
jest.mock('../controllers/paymentController');
jest.mock('../helpers/qrCodeGenerator');

const mockRequest = (body) => ({
    body,
});

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('registerController', () => {
    afterEach(() => {
        jest.clearAllMocks(); // Clear mock history after each test
    });

    it('should return error for exceeding event registration limit', async () => {
        const req = mockRequest({
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                { event_id: new mongoose.Types.ObjectId() },
                { event_id: new mongoose.Types.ObjectId() },
                { event_id: new mongoose.Types.ObjectId() },
                { event_id: new mongoose.Types.ObjectId() },
                { event_id: new mongoose.Types.ObjectId() }, // 5th event
            ],
            amount: 1000,
        });

        const res = mockResponse();

        validationResult.mockReturnValue({ isEmpty: () => true });
        Participant.findOne.mockResolvedValue(null); // No existing participant

        await registerController[2](req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'User can register for up to 4 unique events',
        }));
    });

    it('should return error for missing required fields', async () => {
        const req = mockRequest({
            usn: 'CS123',
            phone: '', // Invalid phone
            college: '',
            registrations: [],
        });

        const res = mockResponse();

        validationResult.mockReturnValue({
            isEmpty: () => false, // Indicates validation errors
            array: () => [{ msg: 'Name is required' }, { msg: 'Phone number is required' }],
        });

        await registerController[2](req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            errors: expect.any(Array),
        }));
    });

    it('should return error for invalid phone number format', async () => {
        const req = mockRequest({
            name: 'John Doe',
            usn: 'CS123',
            phone: 'invalid-phone', // Invalid phone format
            college: 'Example University',
            registrations: [],
            amount: 1000,
        });

        const res = mockResponse();

        validationResult.mockReturnValue({ isEmpty: () => false, array: () => [{ msg: 'Phone number must be valid.' }] });

        await registerController[2](req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            errors: expect.any(Array),
        }));
    });

    it('should successfully register a new participant', async () => {
        const req = mockRequest({
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                    payment_status: 'paid',
                    razorpay_payment_id: 'payment_id_example',
                },
            ],
            amount: 1000,
        });

        const res = mockResponse();

        validationResult.mockReturnValue({ isEmpty: () => true });
        Participant.findOne.mockResolvedValue(null); // No existing participant
        createOrder.mockResolvedValue({ id: 'order_id_example', amount: 1000, currency: 'INR' });

        await registerController[2](req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            orderId: 'order_id_example',
            amount: 1000,
            currency: 'INR',
        }));
    });

    it('should return validation errors', async () => {
        const req = mockRequest({
            name: '', // Invalid name
            usn: '',
            phone: '',
            college: '',
            registrations: [],
        });

        const res = mockResponse();

        validationResult.mockReturnValue({
            isEmpty: () => false, // Indicates validation errors
            array: () => [{ msg: 'Validation error' }],
        });

        await registerController[2](req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            errors: expect.any(Array),
        }));
    });

    it('should return internal server error', async () => {
        const req = mockRequest({
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                    payment_status: 'paid',
                    razorpay_payment_id: 'payment_id_example',
                },
            ],
            amount: 1000,
        });

        const res = mockResponse();

        validationResult.mockReturnValue({ isEmpty: () => true });
        Participant.findOne.mockRejectedValue(new Error('Database error')); // Simulate DB error

        await registerController[2](req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Internal Server Error',
        }));
    });
});

describe('verifyAndRegisterParticipant', () => {
    afterEach(() => {
        jest.clearAllMocks(); // Clear mock history after each test
    });

    it('should return error for invalid payment signature', async () => {
        const req = mockRequest({
            razorpay_payment_id: 'payment_id_example',
            razorpay_order_id: 'order_id_example',
            razorpay_signature: 'invalid_signature',
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                },
            ],
        });

        const res = mockResponse();

        verifyPayment.mockReturnValue(false);

        await verifyAndRegisterParticipant(req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Payment verification failed',
        }));
    });

    it('should return error when participant saving fails', async () => {
        const req = mockRequest({
            razorpay_payment_id: 'payment_id_example',
            razorpay_order_id: 'order_id_example',
            razorpay_signature: 'signature_example',
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                },
            ],
        });

        const res = mockResponse();

        verifyPayment.mockReturnValue(true);
        Participant.findOne.mockResolvedValue(null); // No existing participant
        generateQRCode.mockResolvedValue('mocked-qr-code-data');
        Participant.prototype.save.mockRejectedValue(new Error('Save failed')); // Simulate save error

        await verifyAndRegisterParticipant(req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Internal Server Error',
        }));
    });

    it('should successfully verify payment and register participant', async () => {
        const req = mockRequest({
            razorpay_payment_id: 'payment_id_example',
            razorpay_order_id: 'order_id_example',
            razorpay_signature: 'signature_example',
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                },
            ],
        });

        const res = mockResponse();

        verifyPayment.mockReturnValue(true);
        Participant.findOne.mockResolvedValue(null); // No existing participant
        generateQRCode.mockResolvedValue('mocked-qr-code-data');
        Participant.prototype.save.mockResolvedValue(req.body); // Mock save

        await verifyAndRegisterParticipant(req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'User registered successfully',
        }));
    });

    it('should return error for failed payment verification', async () => {
        const req = mockRequest({
            razorpay_payment_id: 'payment_id_example',
            razorpay_order_id: 'order_id_example',
            razorpay_signature: 'signature_example',
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                },
            ],
        });

        const res = mockResponse();

        verifyPayment.mockReturnValue(false);

        await verifyAndRegisterParticipant(req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Payment verification failed',
        }));
    });

    it('should return internal server error', async () => {
        const req = mockRequest({
            razorpay_payment_id: 'payment_id_example',
            razorpay_order_id: 'order_id_example',
            razorpay_signature: 'signature_example',
            name: 'John Doe',
            usn: 'CS123',
            phone: '9876543210',
            college: 'Example University',
            registrations: [
                {
                    event_id: new mongoose.Types.ObjectId(),
                },
            ],
        });

        const res = mockResponse();

        verifyPayment.mockReturnValue(true);
        Participant.findOne.mockRejectedValue(new Error('Database error')); // Simulate DB error

        await verifyAndRegisterParticipant(req, res); // Call the controller

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Internal Server Error',
        }));
    });
});


