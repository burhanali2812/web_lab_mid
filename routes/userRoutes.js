const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const User = require("../model/User");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const authMiddleWare = require("../middleWare/authMiddleWare");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


router.post("/send-feedback", authMiddleWare, async (req, res) => {
    const { comment } = req.body;

  const { name, email, phone } = req.user;

  if (!email || !name) {
    return res.status(400).send("Missing email or name");
  }
  const adminEmail = process.env.ADMIN_EMAIL || "teamslostandfound@gmail.com";
const mailOptions = {
  from: `"Lost and Found System" <${process.env.SMTP_USER}>`,
  to: adminEmail, 
  subject: "New User Feedback Received",
  html: `
  <div style="font-family: system-ui, sans-serif, Arial; font-size: 16px; color: #333; max-width: 600px; margin: auto; padding: 24px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <p style="border-top: 1px solid #eaeaea; padding-top: 16px;">
      <strong>Dear Admin,</strong>
    </p>

    <p style="margin-bottom: 16px;">
      A user has submitted feedback through the Lost and Found system. Below are the details:
    </p>

    <div style="margin-bottom: 16px;">
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Contact:</strong> ${phone}</p>
    </div>

    <div style="background-color: #fffbe6; border-left: 4px solid #ffc107; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <p style="margin: 0;"><strong>User's Comment:</strong></p>
      <p style="margin: 8px 0 0 0;">${comment}</p>
    </div>

    <p style="font-size: 14px; color: #666;">
      Please review this feedback and take any necessary actions or note it for system improvements.
    </p>

    <p style="margin-top: 32px;">
      Regards,<br>
      <strong>Lost and Found System</strong>
    </p>
  </div>
  `,
};

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("FeedBack Sent");
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).send("Failed to send Feedback");
  }
});

router.post("/notify-admin-new-user", authMiddleWare, async (req, res) => {
  const { name, email, phone } = req.user;

  if (!name || !email) {
    return res.status(400).json({ message: "Missing user name or email." });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "teamslostandfound@gmail.com";

  const mailOptions = {
    from: `"Lost and Found System" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: "🆕 New User Registered on Lost and Found App",
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; max-width: 600px; margin: auto; background: #f9f9f9; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <h2 style="color: #007BFF;">New User Registered</h2>

        <p>Dear Admin,</p>

        <p>A new user has just created an account on the Lost and Found App. Here are the details:</p>

        <ul style="list-style: none; padding-left: 0;">
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone || 'Not Provided'}</li>
          <li><strong>Registration Time:</strong> ${new Date().toLocaleString()}</li>
        </ul>

        <p style="margin-top: 24px;">Please verify the account if necessary or monitor for activity.</p>

        <p style="margin-top: 32px;">
          Regards,<br/>
          <strong>Lost and Found System</strong>
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Admin notified of new user registration." });
  } catch (error) {
    console.error("Error sending new user email:", error);
    res.status(500).json({ message: "Failed to notify admin." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password, cnic, loginType } = req.body;

  try {
    if (loginType === "email" && !email)
      return res.status(400).json({ message: "Email is required" });

    if (loginType === "cnic" && !cnic)
      return res.status(400).json({ message: "CNIC is required" });

    if (!password)
      return res.status(400).json({ message: "Password is required" });

    let user;
    if (loginType === "email") {
      user = await User.findOne({ email });
    } else if (loginType === "cnic") {
      user = await User.findOne({ cnic });
    }

    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "5h",
    });

    res.status(200).json({
      message: "Login Successful",
      success: true,
      token,
      userId: user._id,
      userName: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/signup/step1", async (req, res) => {
  const { name, email, phone, cnic, address } = req.body;

  if (!name || !email || !phone || !cnic || !address) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    // Check for duplicates
    const [existingEmail, existingCnic] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ cnic }),
    ]);

    if (existingEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Email is already registered" });
    }

    if (existingCnic) {
      return res
        .status(400)
        .json({ success: false, message: "CNIC is already registered" });
    }

    // Create user with personal info only
    const user = new User({
      name,
      email,
      phone,
      cnic,
      address,
    });

    await user.save();

    return res
      .status(201)
      .json({ success: true, message: "Step 1 completed", userId: user._id });
  } catch (error) {
    console.error("Signup step1 error:", error);
    return res.status(500).json({
      success: false,
      message: "Signup failed",
      error: error.message,
    });
  }
});


router.post("/signup/step3", async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ success: false, message: "User ID and password are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    const title = "Account Verification Pending – Stay Updated!";
    const message = `
      Thank you for registering with us! Your account is currently under review by our admin team.
      Please check back daily for updates on your verification process.
  
      Regards,
      The Lost and Found Team
    `;

    await fetch("https://lost-and-found-backend-xi.vercel.app/auth/pushNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, message: message.replace(/<br\/?>/g, "\n") }),
    });

    //  Send email to user
    await transporter.sendMail({
      from: `"Lost & Found" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: title,
      html: message,
    });
    const adminEmail = "teamslostandfound@gmail.com";
    const mailOptions = {
      from: `"Lost and Found System" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: "🆕 New User Registered on Lost and Found App",
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; max-width: 600px; margin: auto; background: #f9f9f9; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <h2 style="color: #007BFF;">New User Registered</h2>
          <p>Dear Admin,</p>
          <p>A new user has just completed registration. Here are the details:</p>
          <ul style="list-style: none; padding-left: 0;">
            <li><strong>Name:</strong> ${user.name}</li>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Phone:</strong> ${user.phone || 'Not Provided'}</li>
            <li><strong>Registration Time:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p style="margin-top: 24px;">Please verify the account or monitor activity.</p>
          <p style="margin-top: 32px;">Regards,<br/><strong>Lost and Found System</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: "Password saved and notifications sent." });
  } catch (error) {
    console.error("Signup step3 error:", error);
    return res.status(500).json({ success: false, message: "Failed to complete registration", error: error.message });
  }
});

router.put(
  "/update-profile",
  authMiddleWare,
  async (req, res) => {
    const { name, address } = req.body;
    const userId = req.user._id;

    try {
      const updateData = {};

      if (name) updateData.name = name;
      if (address) updateData.address = address;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Update error:", error);

      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);


router.delete("/deleteUser", authMiddleWare, async (req, res) => {
  try {
    const loggedInUser = req.user; 

    const userToDelete = await User.findById(loggedInUser._id);
    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }


    if (userToDelete.role === "admin" && loggedInUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. You cannot delete an admin." });
    }

    await User.findByIdAndDelete(loggedInUser._id);
    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.delete("/deleteUser/:id", authMiddleWare, async (req, res) => {
if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
//soft delete
router.put("/deleteUser/:id", authMiddleWare, async (req, res) => {
    if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
       id,
      { isDeleted: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/getUser/:id", authMiddleWare, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -cnic" );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/verifyUser/:id", authMiddleWare, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, message } = req.body;
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { isVerified, message },
      { new: true }
    );

    res.status(200).json({ message: "User status updated!" , updatedUser});
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/updateUserVerification", authMiddleWare, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update verification status
    user.isVerified = "requested";
    await user.save();

    const title = "Account Verification Pending – Stay Updated!";
    const message = `
      Thank you for registering with us! Your account is currently under review by our admin team.
      Please check back daily for updates on your verification process.
  
      Regards,
      The Lost and Found Team
    `;

    await fetch("https://lost-and-found-backend-xi.vercel.app/auth/pushNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, message: message.replace(/<br\/?>/g, "\n") }),
    });

    await transporter.sendMail({
      from: `"Lost & Found" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: title,
      html: message,
    });
    const adminEmail = "teamslostandfound@gmail.com";
    const mailOptions = {
  from: `"Lost and Found System" <${process.env.SMTP_USER}>`,
  to: adminEmail,
  subject: "📝 A User Updated Their Information – Review Required",
  html: `
    <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; max-width: 600px; margin: auto; background: #f9f9f9; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <h2 style="color: #FFA500;">User Verification Request</h2>
      <p>Dear Admin,</p>
      <p>The following user has recently updated their profile and requested verification. Please review their updated information:</p>
      <ul style="list-style: none; padding-left: 0;">
        <li><strong>Name:</strong> ${user.name}</li>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>Phone:</strong> ${user.phone || 'Not Provided'}</li>
        <li><strong>Request Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p style="margin-top: 24px;">Please log in to the admin dashboard to review and verify this user's account.</p>
      <p style="margin-top: 32px;">Regards,<br/><strong>Lost and Found System</strong></p>
    </div>
  `,
};


    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "User verification request has been sent." });
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Server error" });
  }
});



router.get("/getAllUser", authMiddleWare, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      // Admin gets all users
      const users = await User.find().sort({createdAt : -1});
      return res.status(200).json({ users });
    }

    // Non-admins can only access their own user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ users: [user] });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/getUserEmail", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = jwt.sign({ email }, process.env.SECRET_KEY, {
        expiresIn: "15m",
      });
      res.status(200).json({ success: true, name: user.name, token });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/reset-password", authMiddleWare, async (req, res) => {
  const { token, newPassword } = req.body;

  try {
   
    const user = await User.findOne({ email: req.user.email });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or expired token" });
  }
});
router.post("/verify-password", authMiddleWare, async (req, res) => {
  const { password, action } = req.body;



  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Password" });
    }

 
    if (action && action.trim().toLowerCase() === "password") {
      const token = jwt.sign({ email: user.email }, process.env.SECRET_KEY, {
        expiresIn: "5h",
      });


      return res.status(200).json({
        success: true,
        name: user.name,
        token,
        message: "Password verified successfully",
      });
    }
    return res.status(200).json({ message: "Password verified successfully" });
  } catch (error) {
    console.error(" Error verifying password:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;