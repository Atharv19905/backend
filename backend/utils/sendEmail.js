const nodemailer = require("nodemailer");
const fs = require("fs");

const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
        user: process.env.BREVO_LOGIN,      // from Brevo SMTP
        pass: process.env.BREVO_SMTP_KEY    // SMTP key (NOT API key)
    }
});

const sendEmail = async (to, subject, text, attachments = []) => {

    try {

        // Convert attachments (same as nodemailer format)
        const formattedAttachments = attachments.map(file => ({
            filename: file.filename,
            path: file.path
        }));

        await transporter.sendMail({
            from: '"System" <atharvpchougule19@gmail.com>', // verified sender
            to,
            subject,
            text,
            attachments: formattedAttachments
        });


    } catch (err) {

        console.error("❌ Email error:", err.message);
        throw err;

    }

};

module.exports = sendEmail;