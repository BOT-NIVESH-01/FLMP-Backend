const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    day: String, // Monday, Tuesday...
    slot: Number, // 1, 2, 3, 4
    subject: String,
    class: String
});

module.exports = mongoose.model('Timetable', TimetableSchema);