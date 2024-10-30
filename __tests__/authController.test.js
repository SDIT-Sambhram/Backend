import mongoose from "mongoose";
import request from "supertest";
import { createRegistration, registerParticipant } from "../controllers/registrationController.js";
import app from "../app"; // Your Express app
import Participant from "../models/Participant.js";

// Mock Participant model
jest.mock("../models/Participant.js");
jest.mock("../controllers/paymentController.js", () => ({
    createOrder: jest.fn().mockResolvedValue({ id: "order123", amount: 100, currency: "INR", key: "testKey" }),
}));

beforeEach(async () => {
    jest.clearAllMocks();
    await mongoose.connect("mongodb://localhost:27017/test", { useNewUrlParser: true, useUnifiedTopology: true });
});

afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
});

describe("Participant Registration", () => {
    test("should create registration successfully for a new participant", async () => {
        Participant.findOne.mockResolvedValue(null); // No existing participant
        const response = await request(app)
            .post("/api/registration") // Adjust your endpoint
            .send({
                name: "John Doe",
                usn: "USN123",
                phone: "1234567890",
                college: "XYZ College",
                registrations: [{ event_id: "event1" }],
                amount: 100,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.orderId).toBeDefined();
    });

    test("should fail registration when participant already registered for max events", async () => {
        Participant.findOne.mockResolvedValue({
            registrations: [{ event_id: "event1" }, { event_id: "event2" }, { event_id: "event3" }, { event_id: "event4" }]
        }); // Existing participant with max events

        const response = await request(app)
            .post("/api/registration") // Adjust your endpoint
            .send({
                name: "John Doe",
                usn: "USN123",
                phone: "1234567890",
                college: "XYZ College",
                registrations: [{ event_id: "event5" }],
                amount: 100,
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("User can register for up to 4 unique events");
    });

    test("should register participant successfully after payment confirmation", async () => {
        Participant.findOne.mockResolvedValue(null); // No existing participant
        const registrationResponse = await request(app)
            .post("/api/registration")
            .send({
                name: "John Doe",
                usn: "USN123",
                phone: "1234567890",
                college: "XYZ College",
                registrations: [{ event_id: "event1" }],
                amount: 100,
            });

        // Now register the participant
        const response = await request(app)
            .post("/api/register")
            .send({
                name: "John Doe",
                usn: "USN123",
                phone: "1234567890",
                college: "XYZ College",
                registrations: [{ event_id: "event1", order_id: registrationResponse.body.orderId }],
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.participant).toHaveProperty("_id");
        expect(response.body.participant.name).toBe("John Doe");
    });

    test("should fail to register participant if missing required fields", async () => {
        const response = await request(app)
            .post("/api/register") // Adjust your endpoint
            .send({}); // Missing all fields

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Missing required fields");
    });

    test("should not allow registration for already registered events", async () => {
        const existingParticipant = {
            registrations: [{ event_id: "event1" }],
        };
        Participant.findOne.mockResolvedValue(existingParticipant);

        const response = await request(app)
            .post("/api/register") // Adjust your endpoint
            .send({
                name: "Jane Doe",
                usn: "USN124",
                phone: "1234567890",
                college: "XYZ College",
                registrations: [{ event_id: "event1" }], // Already registered
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("User has already registered for one or more events");
    });

    test("should fail if input validation fails", async () => {
        const response = await request(app)
            .post("/api/registration")
            .send({
                usn: "USN123", // Missing name
                phone: "1234567890",
                college: "XYZ College",
                registrations: [{ event_id: "event1" }],
                amount: 100,
            });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ msg: "Name is required" })
        ]));
    });

    test("should fail if phone number is invalid", async () => {
        const response = await request(app)
            .post("/api/registration")
            .send({
                name: "John Doe",
                usn: "USN123",
                phone: "abcde", // Invalid phone
                college: "XYZ College",
                registrations: [{ event_id: "event1" }],
                amount: 100,
            });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ msg: "Phone number must be numeric" })
        ]));
    });

    test("should fail if no registrations are provided", async () => {
        const response = await request(app)
            .post("/api/registration")
            .send({
                name: "John Doe",
                usn: "USN123",
                phone: "1234567890",
                college: "XYZ College",
                registrations: [], // No registrations
                amount: 100,
            });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ msg: "At least one registration is required" })
        ]));
    });
});
