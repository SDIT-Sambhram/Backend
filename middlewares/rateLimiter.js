import rateLimit from 'express-rate-limit';

const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        success: false,
        message: 'Too many registration attempts from this IP, please try again after 15 minutes'
    }
});

export default registrationLimiter;