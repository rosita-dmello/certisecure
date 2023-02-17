const Auth = require('./../models/auth.schema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto-js');
const fs = require('fs');

const generateOtp = (otpLength) => {
    let digits = '0123456789';
    let otp = '';
    for (let i = 0; i < otpLength; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

const sendEmail = async (toEmail, subject, body) => {
    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD
        },
        tls: {
            ciphers: 'SSLv3'
        }
    });

    let mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: toEmail,
        subject: subject,
        text: body
    };

    await transporter.sendMail(mailOptions);
};

const sendEmailOtp = async (req, user) => {
    const milliseconds = new Date().getTime();
    const lessMinute = milliseconds - 1 * 60 * 1000;
    const lessMinuteDate = new Date(lessMinute);

    const otp = generateOtp(6);
    const emailSubject = 'Verification Code';
    const emailBody = `Your verification code is ${otp}`;
    await sendEmail(user.email, emailSubject, emailBody);

    const auth = await new Auth({
        user: {
            id: user._id,
            email: user.email
        },
        token: otp,
        tokenType: 'EMAIL VERIFICATION CODE',
        expireAt: lessMinuteDate,
        lastAccess: new Date(),
        clientIPAddress: req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
    }).save();

    return auth;
};

const hashPassword = (password) => {
    password = bcrypt.hashSync(password, 8);
    return password;
};

const validatePassword = (password, hashPassword) => {
    const verify = bcrypt.compareSync(password, hashPassword);
    return verify;
};

const generateBearerToken = async (user) => {
    const token = jwt.sign(
        {
            id: user._id,
            name: user.name,
            email: user.email,
            isActivated: user.isActivated,
            role: user.role
        },
        process.env.JWT_SECRET
    );

    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() + 24);

    await new Auth({
        token: token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isActivated: user.isActivated,
            role: user.role
        },
        tokenType: 'BEARER',
        expireAt: expireDate,
        lastAccess: new Date()
    }).save();

    return {
        token,
        expireDate
    };
};

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const ipfs = async (data) => {
    const auth =
        'Basic ' +
        Buffer.from(
            process.env.INFURA_API_KEY + ':' + process.env.INFURA_API_SECRET
        ).toString('base64');

    const client = ipfsClient.create({
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
        headers: {
            authorization: auth
        }
    });

    const buffer = fs.readFileSync(data.path);

    let result = await client.add(buffer);
    console.log(result.cid);
    let url = process.env.IPFS_URI + '/' + result.path;
    return url;
};

module.exports = {
    generateOtp,
    sendEmail,
    sendEmailOtp,
    hashPassword,
    validatePassword,
    generateBearerToken,
    cloudinary,
    ipfs
};
