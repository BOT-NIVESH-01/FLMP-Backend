const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String, 
  type: { type: String, enum: ['Casual', 'Medical', 'Personal'] }, // Updated enum
  date: String, 
  reason: String,
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  substitutions: [{
    slot: Number,
    subject: String,
    class: String,
    subId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subName: String,
    status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
    date: String // <--- ADD THIS FIELD
  }]
});

module.exports = mongoose.model('Leave', LeaveSchema);