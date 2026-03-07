const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const User = require('../models/User');
const Leave = require('../models/Leave');
const Timetable = require('../models/Timetable');

const getDayName = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const getWeekRange = (dateStr) => {
  const curr = new Date(dateStr);
  const day = curr.getDay() || 7; 
  if(day !== 1) curr.setHours(-24 * (day - 1)); 
  const monday = new Date(curr);
  const sunday = new Date(curr);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
};

router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.get('/timetable', auth, async (req, res) => {
  try {
    const { date } = req.query;
    let query = {};

    if (date) {
      query = { $or: [{ date: { $exists: false } }, { date: null }, { date: date }] };
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      query = { $or: [{ date: { $exists: false } }, { date: null }, { date: { $gte: todayStr } }] };
    }

    const timetable = await Timetable.find(query);
    res.json(timetable);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.get('/leaves', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    let leaves;
    const role = currentUser.role ? currentUser.role.toUpperCase() : '';

    if (role === 'HOD' || role === 'ADMIN') {
      leaves = await Leave.find().sort({ date: -1 });
    } else {
      leaves = await Leave.find({
        $or: [{ userId: req.user.id }, { "substitutions.subId": req.user.id }]
      }).sort({ date: -1 });
    }
    res.json(leaves);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// --- UPDATED: POST LEAVE WITH HOD AUTO APPROVE ---
router.post('/leaves', auth, async (req, res) => {
  try {
    const { type, date, reason, substitutions, startTime, endTime } = req.body;
    
    const existingLeave = await Leave.findOne({ 
      userId: req.user.id, 
      date: date,
      status: { $in: ['Pending', 'Approved'] }
    });

    if (existingLeave) return res.status(400).json({ msg: 'You have already applied for leave on this date.' });

    if (type === 'Partial') {
      const { start, end } = getWeekRange(date);
      const existingPartialInWeek = await Leave.findOne({
        userId: req.user.id,
        type: 'Partial',
        date: { $gte: start, $lte: end },
        status: { $in: ['Pending', 'Approved'] }
      });
      if (existingPartialInWeek) {
        return res.status(400).json({ msg: `Partial leave is allowed only once per week. Used on: ${existingPartialInWeek.date}` });
      }
    }

    const user = await User.findById(req.user.id);
    const role = user.role ? user.role.toUpperCase() : '';
    
    // FEATURE: Auto Approve for HOD/Admin
    const initialStatus = (role === 'HOD' || role === 'ADMIN') ? 'Approved' : 'Pending';

    const newLeave = new Leave({
      userId: req.user.id,
      userName: user.name,
      type,
      date,
      startTime,
      endTime,
      reason,
      status: initialStatus,
      substitutions 
    });

    const leave = await newLeave.save();

    // If HOD Auto-Approved, immediately deduct leave balance
    if (initialStatus === 'Approved' && type !== 'Partial') {
      const typeKey = type.toLowerCase(); 
      if (['casual', 'sick', 'personal'].includes(typeKey)) {
         await User.findByIdAndUpdate(req.user.id, { $inc: { [`leaveBalance.${typeKey}`]: -1 } });
      }
    }

    res.json(leave);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// --- UPDATED: STRICT TIMETABLE LOGIC ---
router.patch('/leaves/:id/substitute', auth, async (req, res) => {
  const { slot, status } = req.body; 

  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ msg: 'Leave not found' });

    const subIndex = leave.substitutions.findIndex(s => s.slot === parseInt(slot) && s.subId.toString() === req.user.id);
    if (subIndex === -1) return res.status(401).json({ msg: 'Not authorized for this substitution' });

    leave.substitutions[subIndex].status = status;
    await leave.save();

    // FEATURE: Update timetable ONLY if leave is already Approved (HOD exception scenario)
    if (status === 'Accepted' && leave.status === 'Approved') {
        const subReq = leave.substitutions[subIndex];
        const targetDate = subReq.date || leave.date;
        const dayName = getDayName(targetDate);

        await Timetable.create({
            userId: req.user.id,
            day: dayName,
            slot: subReq.slot,
            subject: `Sub: ${subReq.subject}`,
            class: subReq.class,
            date: targetDate 
        });
    }

    res.json(leave);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.patch('/leaves/:id/force-substitute', auth, async (req, res) => {
  const { slot, subId, subName } = req.body;

  try {
    const currentUser = await User.findById(req.user.id);
    const role = currentUser.role ? currentUser.role.toUpperCase() : '';

    if (!currentUser || (role !== 'HOD' && role !== 'ADMIN')) {
      return res.status(403).json({ msg: 'Not authorized.' });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ msg: 'Leave not found' });

    const subIndex = leave.substitutions.findIndex(s => s.slot === parseInt(slot));
    if (subIndex === -1) return res.status(404).json({ msg: 'Slot not found' });

    leave.substitutions[subIndex].subId = subId;
    leave.substitutions[subIndex].subName = subName;
    leave.substitutions[subIndex].status = 'Accepted';
    await leave.save();
    
    // Admin force assign implies approval if it's already an approved leave
    if (leave.status === 'Approved') {
        const subReq = leave.substitutions[subIndex];
        const targetDate = subReq.date || leave.date;
        const dayName = getDayName(targetDate);

        await Timetable.create({
            userId: subId,
            day: dayName,
            slot: subReq.slot,
            subject: `Sub: ${subReq.subject}`,
            class: subReq.class,
            date: targetDate 
        });
    }

    res.json(leave);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.patch('/leaves/:id/status', auth, async (req, res) => {
  const { status } = req.body; 

  try {
    const currentUser = await User.findById(req.user.id);
    const role = currentUser.role ? currentUser.role.toUpperCase() : '';

    if (!currentUser || (role !== 'HOD' && role !== 'ADMIN')) {
      return res.status(403).json({ msg: 'Not authorized.' });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ msg: 'Leave not found' });

    leave.status = status;

    // FEATURE: If HOD rejects, cascade the rejection to pending substitutions
    if (status === 'Rejected') {
      leave.substitutions.forEach(sub => {
        if (sub.status === 'Pending') {
          sub.status = 'Rejected';
        }
      });
    }

    await leave.save();

    // When explicitly approved, push all currently accepted subs into timetable
    if (status === 'Approved') {
      const acceptedSubs = leave.substitutions.filter(sub => sub.status === 'Accepted');
      if (acceptedSubs.length > 0) {
        const timetableEntries = acceptedSubs.map(sub => {
           const targetDate = sub.date || leave.date;
           const dayName = getDayName(targetDate);
           return {
             userId: sub.subId, 
             day: dayName,
             slot: sub.slot,
             subject: `Sub: ${sub.subject}`,
             class: sub.class,
             date: targetDate 
           };
        });
        await Timetable.insertMany(timetableEntries);
      }

      if (leave.type !== 'Partial') { 
          const typeKey = leave.type.toLowerCase(); 
          if (['casual', 'sick', 'personal'].includes(typeKey)) {
             await User.findByIdAndUpdate(leave.userId, { $inc: { [`leaveBalance.${typeKey}`]: -1 } });
          }
      }
    }

    res.json(leave);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;