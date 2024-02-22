var nodemailer = require("nodemailer");

var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "jaingeetansh@gmail.com",
        pass: "bludpdclxjlhbhiu",
    },
});

var mailOptions = {
    from: "jaingeetansh@gmail.com",
    to: "haraksh0541.be21@chitkara.edu.in",
    subject: "Sending Email using Node.js",
    text: "chus le mera",
};

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log("Email sent: " + info.response);
        }
    });

