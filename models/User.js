const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Store hashed passwords
    role: { type: String, enum: ['Faculty', 'HOD', 'Admin'], default: 'Faculty' },
    department: String,
    leaveBalance: {
        casual: { type: Number, default: 12 },
        sick: { type: Number, default: 10 },
        personal: { type: Number, default: 5 }
    }
});

module.exports = mongoose.model('User', UserSchema);