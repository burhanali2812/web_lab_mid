const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const otpMap = new Map();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
function generateOTP() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return otp;
}
router.post("/send-otp", async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).send("Missing email or name");
  }

  const otp = generateOTP();
  otpMap.set(email, otp);
  setTimeout(() => otpMap.delete(email), 60000);

  const mailOptions = {
    from: `"Verify OTP" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "OTP For Lost and Found Authentication",
    html: `
    <div style="font-family: system-ui, sans-serif, Arial; font-size: 16px; color: #333; max-width: 600px; margin: auto; padding: 24px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <p style="border-top: 1px solid #eaeaea; padding-top: 16px;">
        <strong>Hello ${name},</strong>
      </p>

      <p style="margin-bottom: 16px;">
        To authenticate your identity, please use the One-Time Password (OTP) provided below:
      </p>

      <p style="font-size: 28px; font-weight: bold; color: #007BFF; text-align: center; letter-spacing: 2px; margin: 20px 0;">
        ${otp}
      </p>

      <p style="text-align: center; font-size: 14px; color: #888; margin-bottom: 24px;">
        This OTP is valid for <strong>1 minute</strong>.
      </p>

      <p style="margin-bottom: 16px;">
        <strong>Important:</strong> Never share your OTP with anyone. If you didn't request this code, you can safely ignore this email.
      </p>

      <p style="font-size: 14px; color: #666;">
        <strong>Teams Lost and Found</strong> will never contact you asking for your code or login information. Please stay vigilant and report any suspicious activity.
      </p>

      <p style="margin-top: 32px;">
        Thank you for using <strong>Lost and Found</strong>!
      </p>
    </div>
  `,
  };
  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("OTP sent");
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).send(error);
  }
});

router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const savedOtp = otpMap.get(email);
  if (savedOtp === otp) {
    otpMap.delete(email);
    return res.status(200).json({ success: true, message: "OTP verified" });
  }

  return res.status(400).json({ success: false, message: "Invalid OTP" });
});

module.exports = router;