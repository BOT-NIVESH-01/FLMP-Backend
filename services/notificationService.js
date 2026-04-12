const User = require('../models/User');
const Leave = require('../models/Leave');
const Timetable = require('../models/Timetable');
const { isEmailConfigured, sendEmail } = require('./emailService');

const roleUpper = (value) => (value ? value.toUpperCase() : '');

const dayNameForDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const runSafe = (promise, contextLabel) => {
    promise.catch((err) => {
        console.error(`[Notification] ${contextLabel}:`, err.message);
    });
};

const emailMany = async ({ recipients, subject, text, html }) => {
    const uniqueRecipients = [...new Set((recipients || []).filter(Boolean))];
    if (uniqueRecipients.length === 0) return;

    await Promise.allSettled(
        uniqueRecipients.map((recipient) =>
            sendEmail({
                to: recipient,
                subject,
                text,
                html
            })
        )
    );
};

const notifyLeaveApplied = async (leaveDoc) => {
    if (!isEmailConfigured()) return;

    const [applicant, approvers] = await Promise.all([
        User.findById(leaveDoc.userId).select('name email'),
        User.find({ role: { $in: ['HOD', 'Admin', 'DEO'] } }).select('name email role')
    ]);

    if (!applicant?.email) return;

    const approverEmails = approvers.map((user) => user.email).filter(Boolean);
    const subject = `Leave Applied - ${applicant.name} (${leaveDoc.date})`;
    const applicantText = `Hi ${applicant.name}, your leave request for ${leaveDoc.date} (${leaveDoc.type}) is submitted with status ${leaveDoc.status}.`;
    const approverText = `${applicant.name} has applied for ${leaveDoc.type} leave on ${leaveDoc.date}. Current status: ${leaveDoc.status}.`;

    await Promise.allSettled([
        emailMany({ recipients: [applicant.email], subject, text: applicantText, html: `<p>${applicantText}</p>` }),
        emailMany({ recipients: approverEmails, subject, text: approverText, html: `<p>${approverText}</p>` })
    ]);
};

const notifyLeaveStatusUpdated = async (leaveDoc, updatedByUserId) => {
    if (!isEmailConfigured()) return;

    const [applicant, actor] = await Promise.all([
        User.findById(leaveDoc.userId).select('name email'),
        User.findById(updatedByUserId).select('name email role')
    ]);

    if (!applicant?.email) return;

    const statusText = `Hi ${applicant.name}, your leave request for ${leaveDoc.date} (${leaveDoc.type}) is ${leaveDoc.status}.`;
    const actorLabel = actor?.name || 'Approver';
    const subject = `Leave ${leaveDoc.status} - ${leaveDoc.date}`;

    await emailMany({
        recipients: [applicant.email],
        subject,
        text: `${statusText} Updated by: ${actorLabel}.`,
        html: `<p>${statusText}</p><p>Updated by: ${actorLabel}</p>`
    });

    const substituteEmails = (leaveDoc.substitutions || [])
        .filter((sub) => sub.subId)
        .map((sub) => sub.subId.toString());

    if (substituteEmails.length > 0) {
        const substitutes = await User.find({ _id: { $in: substituteEmails } }).select('email name');
        const text = `Leave of ${applicant.name} on ${leaveDoc.date} is ${leaveDoc.status}. Please check substitution assignments.`;

        await emailMany({
            recipients: substitutes.map((user) => user.email),
            subject: `Substitution Update - ${leaveDoc.date}`,
            text,
            html: `<p>${text}</p>`
        });
    }
};

const notifySubstitutionUpdated = async ({ leaveDoc, slot, status, substituteUserId }) => {
    if (!isEmailConfigured()) return;

    const [applicant, substitute] = await Promise.all([
        User.findById(leaveDoc.userId).select('name email'),
        User.findById(substituteUserId).select('name email')
    ]);

    const subject = `Substitution ${status} - ${leaveDoc.date}`;
    const text = `Slot ${slot} substitution for ${leaveDoc.date} is ${status} by ${substitute?.name || 'Faculty'} for ${applicant?.name || leaveDoc.userName}.`;

    await emailMany({
        recipients: [applicant?.email, substitute?.email],
        subject,
        text,
        html: `<p>${text}</p>`
    });
};

const notifyForcedSubstitution = async ({ leaveDoc, slot, substituteUserId, forcedByUserId }) => {
    if (!isEmailConfigured()) return;

    const [applicant, substitute, actor] = await Promise.all([
        User.findById(leaveDoc.userId).select('name email'),
        User.findById(substituteUserId).select('name email'),
        User.findById(forcedByUserId).select('name role')
    ]);

    const subject = `Forced Substitution Assigned - ${leaveDoc.date}`;
    const actorRole = roleUpper(actor?.role || '');
    const text = `Slot ${slot} for ${leaveDoc.date} is assigned to ${substitute?.name || 'faculty'} by ${actor?.name || 'admin'}${actorRole ? ` (${actorRole})` : ''}.`;

    await emailMany({
        recipients: [applicant?.email, substitute?.email],
        subject,
        text,
        html: `<p>${text}</p>`
    });
};

const sendDailyTimetableEmails = async () => {
    if (!isEmailConfigured()) {
        console.log('[Notification] Daily timetable email skipped (email not configured).');
        return;
    }

    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    const dayName = dayNameForDate(todayDate);

    const approvedLeaveUserIds = await Leave.find({
        date: todayDate,
        status: 'Approved'
    }).distinct('userId');

    const users = await User.find({
        _id: { $nin: approvedLeaveUserIds }
    }).select('name email');

    const timetableEntries = await Timetable.find({ day: dayName }).sort({ userId: 1, slot: 1 });
    const entriesByUserId = timetableEntries.reduce((acc, item) => {
        const key = item.userId?.toString();
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    for (const user of users) {
        if (!user.email) continue;

        const rows = entriesByUserId[user._id.toString()] || [];
        const subject = `Today's Timetable - ${todayDate}`;

        if (rows.length === 0) {
            const text = `Hi ${user.name}, no timetable slots are assigned for today (${dayName}).`;
            await sendEmail({ to: user.email, subject, text, html: `<p>${text}</p>` });
            continue;
        }

        const listText = rows
            .map((slot) => `Slot ${slot.slot}: ${slot.subject || 'Subject'} - ${slot.class || 'Class'}`)
            .join('\n');

        const listHtml = rows
            .map((slot) => `<li>Slot ${slot.slot}: ${slot.subject || 'Subject'} - ${slot.class || 'Class'}</li>`)
            .join('');

        const text = `Hi ${user.name}, today's (${dayName}) timetable:\n${listText}`;
        const html = `<p>Hi ${user.name}, today's (${dayName}) timetable:</p><ul>${listHtml}</ul>`;
        await sendEmail({ to: user.email, subject, text, html });
    }

    console.log(`[Notification] Daily timetable emails processed for ${users.length} users.`);
};

module.exports = {
    runSafe,
    notifyLeaveApplied,
    notifyLeaveStatusUpdated,
    notifySubstitutionUpdated,
    notifyForcedSubstitution,
    sendDailyTimetableEmails
};
