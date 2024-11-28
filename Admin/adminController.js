import spotParticipant from '../models/spotParticipant.js';
import Participant from '../models/Participant.js';
import jwt from 'jsonwebtoken';
import NodeCache from 'node-cache';
import { rateLimit } from 'express-rate-limit';
import expressValidator from 'express-validator';
import Admin from '../models/mainAdmin.js';

const { check, validationResult } = expressValidator;


// Rate limiting middleware with fixed configuration
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: false, // Disable trust proxy
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: 'Too many login attempts, please try again later',
            timestamp: new Date().toISOString()
        });
    },
    keyGenerator: (req) => {
        return req.ip // Use raw IP address
    }
});

// Input validation middleware with improved messages
const validateLogin = [
    check('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
        .escape(),
    check('contact')
        .exists().withMessage('Contact is required')
        .custom((value) => {
            if (!value) return false;
            const numStr = value.toString();
            return /^\d{10}$/.test(numStr);
        }).withMessage('Contact must be a valid 10-digit number'),
    check('password')
        .exists().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// Enhanced cache configuration
const cache = new NodeCache({
    stdTTL: 300,
    checkperiod: 320,
    useClones: false
});

// Helper functions
const handleError = (res, error, status = 500) => {
    console.error(`[${new Date().toISOString()}] Error:`, {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
    });
};

const sendResponse = (res, data, status = 200) => {
    return res.status(status).json({
        success: true,
        timestamp: new Date().toISOString(),
        ...data
    });
};

// Sanitize input
const sanitizeInput = (obj) => {
    return Object.keys(obj).reduce((acc, key) => {
        acc[key] = typeof obj[key] === 'string'
            ? obj[key].trim().replace(/[<>]/g, '')
            : obj[key];
        return acc;
    }, {});
};

// Wrapper for async handlers
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => handleError(res, error));
};

// Remove the loadAdminData function as it's no longer needed

// Update login handler
export const adminLogin = [
    validateLogin,
    loginLimiter,
    asyncHandler(async (req, res) => {
        try {
            const { contact, password, name } = sanitizeInput(req.body);

            console.log('Login data:', { contact, password, name });

            // Find admin in the database
            const adminData = await Admin.findOne({ 
                name: name.trim(),
                phone: contact
            }).select('+password');

            if (!adminData) {
                console.log('Admin not found', { contact});
                return handleError(res, {
                    message: 'Invalid credentials',
                    code: 'AUTH_FAILED'
                }, 401);
            }

            // Check if the password is correct
            if (password !== adminData.password) {
                console.log('Incorrect password', { contact});
                return handleError(res, {
                    message: 'Invalid credentials',
                    code: 'AUTH_FAILED'
                }, 401);
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    name: adminData.name,
                    contact: adminData.phone,
                    role: 'admin',
                    iat: Date.now()
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '12h' }
            );
            console.log('Login successful', { name });

            return sendResponse(res, {
                message: 'Login successful',
                token,
                admin: {
                    name: adminData.name,
                    phone: adminData.phone,
                    role: 'admin'
                }
            });

        } catch (error) {
            console.error('Detailed login error:', error);
            return handleError(res, {
                message: 'Login process failed',
                code: 'LOGIN_ERROR',
                details: error.message
            }, 500);
        }
    })
];

export const createParticipant = asyncHandler(async (req, res) => {
    const sanitizedData = sanitizeInput(req.body);
    const { name, usn, phone, college, registrations } = sanitizedData;

    if (!name || !usn || !phone || !college || !registrations) {
        return handleError(res, new Error('All fields are required'), 400);
    }

    // Clear participants cache on new entry
    cache.del('all_participants');

    const newParticipant = await spotParticipant.create({
        name, usn, phone, college, registrations
    }).catch(error => {
        if (error.code === 11000) {
            throw new Error('Duplicate entry found');
        }
        throw error;
    });

    return sendResponse(res,
        { message: 'Participant created successfully', participant: newParticipant },
        201
    );
});

// Optimize getAllParticipants with pagination
export const getAllParticipants = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const cacheKey = `all_participants_${page}_${limit}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        return sendResponse(res, cachedData);
    }

    // Calculate total counts from both collections
    const [regularTotal, spotTotal] = await Promise.all([
        Participant.countDocuments(),
        spotParticipant.countDocuments()
    ]);

    const totalDocs = regularTotal + spotTotal;
    const skip = (page - 1) * limit;

    // Fetch data from both collections
    const [regularParticipants, spotParticipants] = await Promise.all([
        Participant.find()
            .select('-__v')
            .lean()
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 }),
        spotParticipant.find()
            .select('-__v')
            .lean()
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 })
    ]);

    // Combine and sort by creation date
    const combinedParticipants = [...regularParticipants, ...spotParticipants]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit); // Ensure we only return the requested limit

    const data = {
        participants: combinedParticipants,
        pagination: {
            current: page,
            total: Math.ceil(totalDocs / limit),
            hasMore: page * limit < totalDocs,
            totalParticipants: totalDocs
        },
        summary: {
            regularParticipants: regularTotal,
            spotParticipants: spotTotal
        }
    };

    cache.set(cacheKey, data);
    return sendResponse(res, data);
});

// ...existing code...
