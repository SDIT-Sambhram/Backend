import request from 'supertest';
import express from 'express';
import { registerController } from '../controllers/authController';
import Participant from '../models/Participant';
import mongoose from 'mongoose';
import QRCode from 'qrcode';

// Backend/routes/authRoutes.test.js


const app = express();
app.use(express.json());
app.post('/register', registerController);

jest.mock('../models/Participant');
jest.mock('qrcode', () => ({
    toDataURL: jest.fn().mockResolvedValue('mockQRCode')
}));

describe('POST /register', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should register a new participant successfully', async () => {
        Participant.findOne.mockResolvedValue(null);
        Participant.prototype.save = jest.fn().mockResolvedValue(true);

        const response = await request(app)
            .post('/register')
            .send({
                name: 'John Doe',
                usn: '12345',
                phone: '1234567890',
                college: 'XYZ University',
                registrations: [{ event_id: 'event1', payment_status: 'paid' }]
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('User registered successfully');
    });

    it('should return 400 if payment status is invalid', async () => {
        const response = await request(app)
            .post('/register')
            .send({
                name: 'John Doe',
                usn: '12345',
                phone: '1234567890',
                college: 'XYZ University',
                registrations: [{ event_id: 'event1', payment_status: 'invalid_status' }]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid payment status');
    });

    it('should return 400 if participant is already registered for 3 events', async () => {
        Participant.findOne.mockResolvedValue({
            registrations: [{}, {}, {}]
        });

        const response = await request(app)
            .post('/register')
            .send({
                name: 'John Doe',
                usn: '12345',
                phone: '1234567890',
                college: 'XYZ University',
                registrations: [{ event_id: 'event1', payment_status: 'paid' }]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('User can register for a maximum of 3 events');
    });

    it('should return 400 if participant is already registered for the event', async () => {
        Participant.findOne.mockResolvedValue({
            registrations: [{ event_id: 'event1' }]
        });

        const response = await request(app)
            .post('/register')
            .send({
                name: 'John Doe',
                usn: '12345',
                phone: '1234567890',
                college: 'XYZ University',
                registrations: [{ event_id: 'event1', payment_status: 'paid' }]
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Event ID event1 is already registered.');
    });

    it('should return 400 if name field is missing', async () => {
        const response = await request(app)
            .post('/register')
            .send({
                usn: '12345',
                phone: '1234567890',
                college: 'XYZ University',
                registrations: [{ event_id: 'event1', payment_status: 'paid' }]
            });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ msg: 'Name is required' })
            ])
        );
    });

    it('should return 500 if there is an internal server error', async () => {
        Participant.findOne.mockRejectedValue(new Error('Internal Server Error'));

        const response = await request(app)
            .post('/register')
            .send({
                name: 'John Doe',
                usn: '12345',
                phone: '1234567890',
                college: 'XYZ University',
                registrations: [{ event_id: 'event1', payment_status: 'paid' }]
            });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Internal Server Error');
    });
});