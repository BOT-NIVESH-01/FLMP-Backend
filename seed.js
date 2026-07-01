const mongoose = require('mongoose');
const dotenv = require('dotenv');

const User = require('./models/User');
const Timetable = require('./models/Timetable');
const Leave = require('./models/Leave');

dotenv.config();

const seedDatabase = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is required for seeding.');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        // Start from clean onboarding state: only Admin exists.
        await User.deleteMany({});
        await Timetable.deleteMany({});
        await Leave.deleteMany({});
        console.log('Old data cleared.');

        await User.create({
            name: 'System Admin',
            email: 'admin@uni.edu',
            password: 'admin',
            role: 'Admin',
            department: 'Administration',
            leaveBalance: { casual: 12, sick: 10, personal: 5 }
        });

        console.log('Admin user seeded.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDatabase();
