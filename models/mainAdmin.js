import mongoose from 'mongoose';

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
    }
});

const Admin = mongoose.models.admin || mongoose.model('admin', adminSchema);
export default Admin;
