const express = require("express");
const authMiddleWare = require("../middleWare/authMiddleWare");
const Notifications = require("../model/Notifications");
const router = express.Router();


const nodemailer = require("nodemailer");
const User = require("../model/User");
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


router.post("/pushNotification", async (req, res) => {
  const { userId, title, message } = req.body;

  try {
    const notification = new Notifications({ userId, title, message });
    await notification.save();

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const mailOptions = {
      from: `"Lost & Found System" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: title,
      html: message,
    };

    try {
      await transporter.sendMail(mailOptions);
      return res
        .status(200)
        .json({ message: "Notification added and email sent successfully" });
    } catch (emailError) {
      console.error("Email error:", emailError);
      return res.status(500).json({
        message: "Notification added but failed to send email",
        error: emailError,
      });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error adding notification", error });
  }
});

router.get("/get-notifications/:userId", authMiddleWare, async (req, res) => {
  const { userId } = req.params;
  try {
    const notifications = await Notifications.find({ userId }).sort({
      createdAt: -1,
    }); // Sorting by createdAt in descending order to get latest first
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("Error getting user notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching notifications" });
  }
});

router.delete("/delete-notifications/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  try {
    const deletedNotification = await Notifications.findByIdAndDelete(id);

    if (!deletedNotification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      deletedNotification,
    });
  } catch (error) {
    console.error("Error deleting user notification:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting notification" });
  }
});
router.put("/seen-notifications/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  const { isRead } = req.body;

  try {
    const seenNotification = await Notifications.findByIdAndUpdate(
      id,
      { isRead: isRead },
      { new: true }
    );

    if (!seenNotification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Notification seen status updated",
      seenNotification,
      check: isRead,
    });
  } catch (error) {
    console.error("Error updating seen status of notification:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating notification status" });
  }
});

module.exports = router;
