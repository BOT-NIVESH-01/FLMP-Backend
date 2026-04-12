const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass
        }
    });

    return transporter;
};

const getFromEmail = () => process.env.EMAIL_FROM || process.env.SMTP_USER;

const isEmailConfigured = () => Boolean(getTransporter() && getFromEmail());

const sendEmail = async ({ to, subject, text, html }) => {
    const activeTransporter = getTransporter();
    const from = getFromEmail();

    if (!activeTransporter || !from) {
        return {
            skipped: true,
            reason: 'Email provider is not configured. Set SMTP_* and EMAIL_FROM env variables.'
        };
    }

    if (!to) {
        return {
            skipped: true,
            reason: 'Missing recipient email address.'
        };
    }

    const result = await activeTransporter.sendMail({
        from,
        to,
        subject,
        text,
        html
    });

    return {
        skipped: false,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
    };
};

module.exports = {
    isEmailConfigured,
    sendEmail
};
