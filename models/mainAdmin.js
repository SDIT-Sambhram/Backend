import mongoose from 'mongoose';
import crypto from 'crypto';

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    phone: {
        type: Number,
        required: [true, 'Phone number is required'],
        unique: true,
        validate: {
            validator: function (v) {
                return /^\d{10}$/.test(v.toString());
            },
            message: 'Please enter a valid 10-digit phone number'
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    role: {
        type: String,
        default: 'admin',
        enum: ['admin', 'super-admin']
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

// Indexes
adminSchema.index({ phone: 1 });
// Add compound index for faster login queries
adminSchema.index({ phone: 1, name: 1 });

// Remove bcrypt pre-save middleware

// Add cache invalidation on password change
adminSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        // Clear login attempts cache
        cache.del(`login_${this.phone}`);
    }
    next();
});

// Add password strength validation
const validatePassword = (password) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    return regex.test(password);
};

adminSchema.path('password').validate(function (password) {
    return validatePassword(password);
}, 'Password must contain at least one letter, one number, and be at least 6 characters long');

// Update password comparison method for plain text
adminSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return this.password === candidatePassword; // Direct comparison for plain text
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Update last login
adminSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    return this.save();
};

// Static method to find admin by phone
adminSchema.statics.findByPhone = function (phone) {
    return this.findOne({ phone });
};

const Admin = mongoose.models.admin || mongoose.model('admin', adminSchema);
export default Admin;
