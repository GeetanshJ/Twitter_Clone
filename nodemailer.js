const nodemailer = require("nodemailer");

async function sendVerificationEmail(email_to) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: false,
        auth: {
            user: "jaingeetansh@gmail.com",
            pass: "bludpdclxjlhbhiu",
        },
    });

    const info = await transporter.sendMail({
        to: email_to,
        from: "jaingeetansh@gmail.com",
        subject: "Verify your email!",
        html: "<b>Hi, <br> Please click on the link to verify your email id :- <br> <a href=\"http://localhost:8080?" + email_to + "\">Click here</a>"
    });
    if (info.messageId) {
        return true;
    } else {
        return false;
    }
}
console.log("Mail sent successfully..!");
module.exports = sendVerificationEmail



