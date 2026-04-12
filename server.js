const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();
const { sendDailyTimetableEmails, runSafe } = require('./services/notificationService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/data', require('./routes/data')); // Combine logic here

const dailySchedule = process.env.DAILY_TIMETABLE_CRON || '0 6 * * *';
const dailyTimezone = process.env.DAILY_TIMETABLE_TIMEZONE || 'Asia/Kolkata';

cron.schedule(
    dailySchedule,
    () => {
        runSafe(sendDailyTimetableEmails(), 'Daily timetable notification job failed');
    },
    { timezone: dailyTimezone }
);

console.log(`[Notification] Daily timetable job scheduled: ${dailySchedule} (${dailyTimezone})`);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));