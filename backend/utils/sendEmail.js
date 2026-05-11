const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

const sendEmail = async (to, subject, text, attachments = []) => {

    try {

        const email = new brevo.SendSmtpEmail();

        email.sender = {
            name: "System",
            email: "atharvpchougule19@gmail.com"
        };

        email.to = [{ email: to }];
        email.subject = subject;
        email.textContent = text;

        await apiInstance.sendTransacEmail(email);

        console.log("✅ Email sent");

    } catch (err) {

        console.log("❌ Email error:", err.message);

        return null;
    }
};

module.exports = sendEmail;
