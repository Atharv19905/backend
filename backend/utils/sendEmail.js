const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,

    auth: {
        user: process.env.BREVO_LOGIN,
        pass: process.env.BREVO_SMTP_KEY
    },

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});

const sendEmail = async (to, subject, text, attachments = []) => {

    try {

        const formattedAttachments = attachments.map(file => ({
            filename: file.filename,
            path: file.path
        }));

        await transporter.sendMail({
            from: '"System" <atharvpchougule19@gmail.com>',
            to,
            subject,
            text,
            attachments: formattedAttachments
        });

        console.log("✅ Email sent");

    } catch (err) {

        console.error("❌ Email error:", err.message);

        return null; // ✅ IMPORTANT
    }
};

module.exports = sendEmail;
