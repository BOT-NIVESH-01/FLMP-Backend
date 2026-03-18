const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs'); // Added for secure user creation

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
  if (day !== 1) curr.setHours(-24 * (day - 1));
  const monday = new Date(curr);
  const sunday = new Date(curr);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
};

const upsertSubstituteTimetableSlot = async ({ substituteUserId, substitution, leaveDate }) => {
  if (!substituteUserId) return;

  const targetDate = substitution.date || leaveDate;
  const dayName = getDayName(targetDate);

  await Timetable.findOneAndUpdate(
    {
      userId: substituteUserId,
      slot: substitution.slot,
      date: targetDate
    },
    {
      userId: substituteUserId,
      day: dayName,
      slot: substitution.slot,
      subject: `Sub: ${substitution.subject}`,
      class: substitution.class,
      date: targetDate
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

const safeUpsertSubstituteTimetableSlot = async (payload) => {
  try {
    await upsertSubstituteTimetableSlot(payload);
  } catch (err) {
    console.error('Timetable sync failed:', err.message);
  }
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

    if (role === 'HOD' || role === 'ADMIN' || role === 'DEO') {
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

    // Auto Approve for HOD/Admin
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

router.patch('/leaves/:id/substitute', auth, async (req, res) => {
  const { slot, status } = req.body;

  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ msg: 'Leave not found' });

    const subIndex = leave.substitutions.findIndex(s => s.slot === parseInt(slot) && s.subId.toString() === req.user.id);
    if (subIndex === -1) return res.status(401).json({ msg: 'Not authorized for this substitution' });

    leave.substitutions[subIndex].status = status;
    await leave.save();

    if (status === 'Accepted') {
      const subReq = leave.substitutions[subIndex];
      await safeUpsertSubstituteTimetableSlot({
        substituteUserId: req.user.id,
        substitution: subReq,
        leaveDate: leave.date
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

    if (!currentUser || (role !== 'HOD' && role !== 'ADMIN' && role !== 'DEO')) {
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

    const subReq = leave.substitutions[subIndex];
    await safeUpsertSubstituteTimetableSlot({
      substituteUserId: subId,
      substitution: subReq,
      leaveDate: leave.date
    });

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

    // If HOD rejects, cascade the rejection to pending substitutions
    if (status === 'Rejected') {
      leave.substitutions.forEach(sub => {
        if (sub.status === 'Pending') {
          sub.status = 'Rejected';
        }
      });
    }

    await leave.save();

    // When explicitly approved, ensure all currently accepted subs exist in timetable
    if (status === 'Approved') {
      const acceptedSubs = leave.substitutions.filter(sub => sub.status === 'Accepted');
      if (acceptedSubs.length > 0) {
        await Promise.allSettled(
          acceptedSubs.map(sub => safeUpsertSubstituteTimetableSlot({
            substituteUserId: sub.subId,
            substitution: sub,
            leaveDate: leave.date
          }))
        );
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

// ============================================================================
// NEW ADMIN ROUTES
// ============================================================================

// If this file is mounted at `/api/data` in server.js, these routes become:
// /api/data/admin/users
// /api/data/admin/timetable/bulk
// /api/data/admin/users/:id
// /api/data/admin/timetable/:id
// /api/data/admin/timetable

// @route   POST api/data/admin/users
// @desc    Admin creates a new faculty account
// @access  Private (Admin only)
router.post('/admin/users', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const role = currentUser.role ? currentUser.role.toUpperCase() : '';

    if (!currentUser || role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Not authorized. Admin role required.' });
    }

    const { name, email, password, role: newUserRole, department } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User with this email already exists' });
    }

    // Set default leave balances
    const leaveBalance = { casual: 12, sick: 10 };

    user = new User({
      name,
      email,
      password,
      role: newUserRole,
      department,
      leaveBalance
    });

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Return the user document (without password)
    const userResponse = await User.findById(user.id).select('-password');
    res.json(userResponse);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/data/admin/timetable/bulk
// @desc    Admin assigns bulk timetable entries to a newly created faculty
// @access  Private (Admin only)
router.post('/admin/timetable/bulk', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const role = currentUser.role ? currentUser.role.toUpperCase() : '';

    if (!currentUser || role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Not authorized. Admin role required.' });
    }

    const { entries } = req.body;

    if (!entries || entries.length === 0) {
      return res.status(400).json({ msg: 'No timetable entries provided' });
    }

    // Insert all the entries into the Timetable collection at once
    const insertedEntries = await Timetable.insertMany(entries);

    res.json(insertedEntries);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/data/admin/users/:id
// @desc    Admin deletes a faculty account and their timetable
// @access  Private (Admin only)
router.delete('/admin/users/:id', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ msg: 'Not authorized.' });
    }

    await User.findByIdAndDelete(req.params.id);
    await Timetable.deleteMany({ userId: req.params.id });

    res.json({ msg: 'User and associated timetables deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/data/admin/timetable/:id
// @desc    Admin deletes a specific timetable slot
// @access  Private (Admin only)
router.delete('/admin/timetable/:id', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ msg: 'Not authorized.' });
    }

    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Timetable slot deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/data/admin/timetable
// @desc    Admin adds a single timetable slot to an existing user
// @access  Private (Admin only)
router.post('/admin/timetable', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ msg: 'Not authorized.' });
    }

    const newSlot = new Timetable(req.body);
    await newSlot.save();
    res.json(newSlot);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH api/data/admin/users/:id/credentials
// @desc    Admin/DEO updates faculty email and/or password
// @access  Private (Admin, DEO)
router.patch('/admin/users/:id/credentials', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const role = currentUser?.role ? currentUser.role.toUpperCase() : '';

    if (!currentUser || (role !== 'ADMIN' && role !== 'DEO')) {
      return res.status(403).json({ msg: 'Not authorized.' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ msg: 'Faculty not found.' });
    }

    if (targetUser.role?.toUpperCase() !== 'FACULTY') {
      return res.status(400).json({ msg: 'Only faculty accounts can be updated from this panel.' });
    }

    const { email, password } = req.body;
    const updates = {};

    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: targetUser._id } });
      if (existing) {
        return res.status(400).json({ msg: 'Email already in use by another account.' });
      }
      updates.email = normalizedEmail;
    }

    if (password && password.trim()) {
      updates.password = password.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ msg: 'Provide at least one field to update.' });
    }

    const updated = await User.findByIdAndUpdate(targetUser._id, updates, { new: true }).select('-password');
    return res.json(updated);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Server Error');
  }
});

module.exports = router;