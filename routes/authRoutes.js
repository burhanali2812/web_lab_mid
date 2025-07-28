const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const Image = require("../model/Image");
const User = require("../model/User");
const jwt = require("jsonwebtoken");
const authMiddleWare = require("../middleWare/authMiddleWare");
const FoundItems = require("../model/FoundItems");
const LostItems = require("../model/LostItems");
const SavedItems = require("../model/SavedItems");
const Notifications = require("../model/Notifications");
const axios = require("axios");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const sharp = require("sharp");
const nodemailer = require("nodemailer");
const otpMap = new Map();
const router = express.Router();

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
    res.status(500).send("Failed to send OTP");
  }
});

router.post("/send-feedback", authMiddleWare, async (req, res) => {
    const { comment } = req.body;

  const { name, email, phone } = req.user;

  if (!email || !name) {
    return res.status(400).send("Missing email or name");
  }
  const adminEmail = "teamslostandfound@gmail.com";
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


router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const savedOtp = otpMap.get(email);
  if (savedOtp === otp) {
    otpMap.delete(email);
    return res.status(200).json({ success: true, message: "OTP verified" });
  }

  return res.status(400).json({ success: false, message: "Invalid OTP" });
});
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const upload = multer({ storage: multer.memoryStorage() });

const uploadToCloudinary = async (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    const { Readable } = require("stream");
    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);
  });
};
router.post(
  "/upload",
  upload.single("image"),
  authMiddleWare,
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        "lost-and-found/uploads"
      );

      const newImage = new Image({
        imageUrl: uploadResult.secure_url,
        cloudinaryId: uploadResult.public_id,
      });

      await newImage.save();
      res.json({ success: true, imageUrl: newImage.imageUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      res
        .status(500)
        .json({ success: false, message: "Error uploading image" });
    }
  }
);

router.get("/images", authMiddleWare, async (req, res) => {
  try {
    const images = await Image.find();
    res.json(images);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching images" });
  }
});
router.delete("/delete-image/:id", authMiddleWare, async (req, res) => {
  try {
    const { id } = req.params;
    const image = await Image.findById(id);

    if (!image) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    // Delete from Cloudinary first
    if (image.cloudinaryId) {
      await cloudinary.uploader.destroy(image.cloudinaryId);
    }

    // Then delete from database
    await Image.findByIdAndDelete(id);
    res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ success: false, message: "Error deleting image" });
  }
});
router.post("/checkExistEmail", async (req, res) => {
  try {
    const { email , cnic } = req.body;
    const [existingEmail, existingCnic] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ cnic }),
    ]);

    if (existingEmail)
      return res.status(400).json({ message: "Email is already registered" });
    if (existingCnic)
      return res.status(400).json({ message: "CNIC is already registered" });

    return res.status(200).json({ message: "Email and CNIC are available" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Signup failed",
    });
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

router.post("/notify-new-user", authMiddleWare, async (req, res) => {
  const { name, email, phone } = req.user;

  if (!name || !email) {
    return res.status(400).json({ message: "Missing user name or email." });
  }

  const adminEmail = "teamslostandfound@gmail.com";

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

router.post("/signup/step3", async (req, res) => {
  const { userId, password, token } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ success: false, message: "User ID and password are required" });
  }

  if (!token) {
    return res.status(400).json({ success: false, message: "reCAPTCHA token is missing" });
  }

  try {
    // ✅ reCAPTCHA verification
    const response = await axios.post("https://www.google.com/recaptcha/api/siteverify", null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET,
        response: token,
      },
    });

    if (!response.data.success) {
      return res.status(400).json({ success: false, message: "reCAPTCHA failed" });
    }

    // ✅ Update user password
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    // ✅ Send push notification
    const title = "Account Verification Pending – Stay Updated!";
    const message = `
      Thank you for registering with us! Your account is currently under review by our admin team.
      Please check back daily for updates on your verification process.
      <br/><br/>
      Regards,<br/>
      The Lost and Found Team
    `;

    await fetch("https://lost-and-found-backend-xi.vercel.app/auth/pushNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, message: message.replace(/<br\/?>/g, "\n") }),
    });

    // ✅ Send email to user
    await transporter.sendMail({
      from: `"Lost & Found" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: title,
      html: message,
    });

    // ✅ Send email to admin
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





router.post(
  "/signup/step2",
  upload.fields([
    { name: "profileImage" },
    { name: "frontCnic" },
    { name: "backCnic" },
  ]),
  async (req, res) => {
    const { userId} = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing user ID" });
    }
      

    try {
      
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Upload handler
      const uploadFile = async (file) => {
        if (!file) return null;
        try {
          const mimetype = file[0].mimetype;
          let compressedBuffer;
          const image = sharp(file[0].buffer).resize({ width: 1024 });

          if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
            compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
          } else if (mimetype === "image/png") {
            compressedBuffer = await image.png({ quality: 80 }).toBuffer();
          } else {
            compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
          }

          const result = await uploadToCloudinary(
            compressedBuffer,
            "lost-and-found/user-documents"
          );
          return result.secure_url;
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("Image upload failed");
        }
      };

      const [profileImage, frontCnic, backCnic] = await Promise.all([
        uploadFile(req.files["profileImage"]),
        uploadFile(req.files["frontCnic"]),
        uploadFile(req.files["backCnic"]),
      ]);

      // Update user record
      user.profileImage = profileImage;
      user.frontCnic = frontCnic;
      user.backCnic = backCnic;
      await user.save();
      res.status(200).json({ success: true, message: "Documents uploaded successfully", user });
    } catch (error) {
      console.error("Signup step2 error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);




// router.post(
//   "/signup",
//   upload.fields([
//     { name: "profileImage" },
//     { name: "frontCnic" },
//     { name: "backCnic" },
//   ]),
//   async (req, res) => {
//     const { name, email, password, phone, cnic, address, token } = req.body;

//     // Basic validation
//     if (!name || !email || !password || !phone || !cnic || !address || !token) {
//       return res
//         .status(400)
//         .json({ success: false, message: "All fields are required" });
//     }

//     try {
//       // Verify reCAPTCHA
//       const response = await axios.post(
//         `https://www.google.com/recaptcha/api/siteverify`,
//         null,
//         {
//           params: {
//             secret: process.env.RECAPTCHA_SECRET,
//             response: token,
//           },
//         }
//       );

//       if (!response.data.success) {
//         return res
//           .status(400)
//           .json({ success: false, message: "reCAPTCHA failed" });
//       }

//       // Check for existing user
//       const [existingEmail, existingCnic] = await Promise.all([
//         User.findOne({ email }),
//         User.findOne({ cnic }),
//       ]);

//       if (existingEmail)
//         return res.status(400).json({ message: "Email is already registered" });
//       if (existingCnic)
//         return res.status(400).json({ message: "CNIC is already registered" });

//       // Hash password
//       const salt = await bcrypt.genSalt(10);
//       const hashedPassword = await bcrypt.hash(password, salt);

//       // Upload files to Cloudinary
//       const uploadFile = async (file) => {
//         if (!file) return null;
//         try {
//           const mimetype = file[0].mimetype;
//           let compressedBuffer;

//           const image = sharp(file[0].buffer).resize({ width: 1024 });

//           if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
//             compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
//           } else if (mimetype === "image/png") {
//             compressedBuffer = await image.png({ quality: 80 }).toBuffer();
//           } else if (mimetype === "image/webp") {
//             compressedBuffer = await image.webp({ quality: 75 }).toBuffer();
//           } else {
//             // fallback to jpeg
//             compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
//           }

//           const result = await uploadToCloudinary(
//             compressedBuffer,
//             "lost-and-found/user-documents"
//           );
//           return result.secure_url;
//         } catch (uploadError) {
//           console.error("Cloudinary upload error:", uploadError);
//           throw new Error("Failed to upload document");
//         }
//       };

//       const [profileImage, frontCnic, backCnic] = await Promise.all([
//         uploadFile(req.files["profileImage"]),
//         uploadFile(req.files["frontCnic"]),
//         uploadFile(req.files["backCnic"]),
//       ]);

//       // Create user
//       const user = new User({
//         name,
//         email,
//         password: hashedPassword,
//         phone,
//         cnic,
//         address,
//         profileImage,
//         frontCnic,
//         backCnic,
//       });

//       await user.save();

//       // Send notification and email
//       const title = "Account Verification Pending – Stay Updated!";
//       const message =
//         "Thank you for registering with us! Your account is currently under review by our admin team to ensure all details are accurate and complete. Please be assured that we are working diligently to process your request. To stay informed on the status of your account, we encourage you to check back daily for updates on your verification process. We appreciate your patience and look forward to providing you with an exceptional experience once your account is fully verified.<br><br>Regards,<br>The Lost and Found Team";

//       try {
//         // Trigger internal notification
//         const newResponse = await fetch(
//           `https://lost-and-found-backend-xi.vercel.app/auth/pushNotification`,
//           {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//               userId: user._id,
//               title,
//               message,
//             }),
//           }
//         );

//         if (!newResponse.ok) {
//           console.error("Notification failed:", await newResponse.text());
//         }

//         // Send email
//         const mailOptions = {
//           from: `"Lost & Found System" <${process.env.SMTP_USER}>`,
//           to: user.email,
//           subject: title,
//           html: message,
//         };

//         try {
//           await transporter.sendMail(mailOptions);
//           return res.status(201).json({
//             success: true,
//             message: "Account created successfully. Email sent.",
//             user,
//           });
//         } catch (emailError) {
//           console.error("Email error:", emailError);
//           return res.status(201).json({
//             success: true,
//             message: "Account created. Email failed to send.",
//             user,
//           });
//         }
//       } catch (notificationError) {
//         console.error("Notification error:", notificationError);
//         return res.status(201).json({
//           success: true,
//           message: "Account created. Notification/email may have failed.",
//           user,
//         });
//       }
//     } catch (error) {
//       console.error("Signup error:", error);
//       res.status(500).json({
//         success: false,
//         message: error.message || "Signup failed",
//         error: process.env.NODE_ENV === "development" ? error.stack : undefined,
//       });
//     }
//   }
// );

router.put(
  "/update-profile",
  authMiddleWare,
  upload.fields([
    { name: "profileImage" },
    { name: "frontCnic" },
    { name: "backCnic" },
  ]),
  async (req, res) => {
    const { name, address } = req.body;
    const userId = req.user._id; // Get user ID from auth middleware

    const updateData = {};
    if (name) updateData.name = name;
    if (address) updateData.address = address;

    try {
      const uploadFile = async (file) => {
        if (!file) return null;
        try {
          const mimetype = file[0].mimetype;
          let compressedBuffer;

          const image = sharp(file[0].buffer).resize({ width: 1024 });

          if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
            compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
          } else if (mimetype === "image/png") {
            compressedBuffer = await image.png({ quality: 80 }).toBuffer();
          } else {
            compressedBuffer = await image.jpeg({ quality: 70 }).toBuffer();
          }

          const result = await uploadToCloudinary(
            compressedBuffer,
            "lost-and-found/user-documents"
          );
          return result.secure_url;
        } catch (error) {
          console.error("Cloudinary upload error:", error);
          return null;
        }
      };

      const files = req.files;
      if (files?.profileImage)
        updateData.profileImage = await uploadFile(files.profileImage);
      if (files?.frontCnic)
        updateData.frontCnic = await uploadFile(files.frontCnic);
      if (files?.backCnic)
        updateData.backCnic = await uploadFile(files.backCnic);

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.delete("/deleteUser", authMiddleWare, async (req, res) => {
  try {
    const loggedInUser = req.user; // Extracted from token by authMiddleware

    const userToDelete = await User.findById(loggedInUser._id);
    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent users from deleting admin accounts (unless they are admin themselves)
    if (userToDelete.role === "admin" && loggedInUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. You cannot delete an admin." });
    }

    await User.findByIdAndDelete(loggedInUser._id);
    res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.delete("/deleteUser/:id", authMiddleWare, async (req, res) => {
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
router.put("/deleteUser/:id", authMiddleWare, async (req, res) => {
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
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.put("/verifyUser/:id", authMiddleWare, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, message } = req.body;

    // ✅ Check if the current user is admin
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

    res.json({ message: "User status updated!" });
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/getAllUser", authMiddleWare, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      // Admin gets all users
      const users = await User.find();
      return res.json({ users });
    }

    // Non-admins can only access their own user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ users: [user] }); // Return array with single user for consistency
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
      res.json({ success: true, name: user.name, token });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or expired token" });
  }
});
router.post("/verify-password", authMiddleWare, async (req, res) => {
  const { password, action } = req.body;

  console.log("🔍 Received action:", action); // Add this
  console.log("🔐 Authenticated user:", req.user);

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    // 🔁 Normalize action comparison
    if (action && action.trim().toLowerCase() === "password") {
      const token = jwt.sign({ email: user.email }, process.env.SECRET_KEY, {
        expiresIn: "15m",
      });

      console.log("✅ Password match — sending token:", token); // Add this to verify token generation
      return res.json({
        success: true,
        name: user.name,
        token,
        message: "Password verified successfully",
      });
    }
    return res.status(200).json({ message: "Password verified successfully" });
  } catch (error) {
    console.error("❌ Error verifying password:", error);
    return res.status(500).json({ message: "Server Error" });
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
      expiresIn: "2h",
    });

    res.json({
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

router.get("/search-found", authMiddleWare, async (req, res) => {
  try {
    const { city, category } = req.query;
    let query = {};

    if (city) query.city = new RegExp(city, "i");
    if (category) query.category = new RegExp(category, "i");

    const foundItems = await FoundItems.find(query);

    res.json({ success: true, foundItems });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching in found items" });
  }
});
router.get("/search-lost", authMiddleWare, async (req, res) => {
  try {
    const { city, category } = req.query;
    let query = {};

    if (city) query.city = new RegExp(city, "i");
    if (category) query.category = new RegExp(category, "i");

    const lostItems = await LostItems.find(query);

    res.json({ success: true, lostItems });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching in lost items" });
  }
});

router.get("/get-foundItems", authMiddleWare, async (req, res) => {
  try {
    const foundItems = await FoundItems.find().sort({ createdAt: -1 });
    res.json({ success: true, foundItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching items" });
  }
});
router.post("/get-foundItemsByIds", authMiddleWare, async (req, res) => {
  const { itemIds } = req.body; // itemIds should be an array
  try {
    const foundItems = await FoundItems.find({ _id: { $in: itemIds } }).sort({
      createdAt: -1,
    }); // give all the array of items belong to item ids
    res.json({ success: true, foundItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching items" });
  }
});
router.get("/get-foundItemById/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  try {
    const foundItem = await FoundItems.findById(id); // correct method
    if (!foundItem) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }
    res.json({ success: true, foundItem });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching item" });
  }
});

router.get("/get-lostItems", authMiddleWare, async (req, res) => {
  try {
    const lostItems = await LostItems.find().sort({ createdAt: -1 });
    res.json({ success: true, lostItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching items" });
  }
});
router.post(
  "/add-foundItems",
  upload.array("images"),
  authMiddleWare,
  async (req, res) => {
    const {
      userId,
      title,
      category,
      subCategory,
      brand,
      description,
      city,
      location,
      dateFound,
    } = req.body;

    if (!userId || !title || !category || !city || !dateFound) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      // Upload all images to Cloudinary
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer, "lost-and-found/found-items")
      );

      const uploadResults = await Promise.all(uploadPromises);
      const imageUrls = uploadResults.map((result) => result.secure_url);

      const item = new FoundItems({
        userId,
        title,
        category,
        subCategory,
        brand,
        description,
        city,
        location,
        dateFound,
        imageUrl: imageUrls,
      });

      await item.save();
      res.json({ success: true, item });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error adding item", error });
    }
  }
);

router.put("/verifyLostItems/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  const { request } = req.body;

  try {
    const verifyItems = await LostItems.findByIdAndUpdate(
      id,
      { request },
      { new: true }
    );

    if (!verifyItems) {
      return res
        .status(404)
        .json({ success: false, message: "Lost Item  not found" });
    }

    res.json({ success: true, message: "Lost item verified", verifyItems });
  } catch (error) {
    console.error("Error updating Lost Items:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating Lost Items" });
  }
});

router.put("/verifyFoundItems/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  const { request } = req.body;

  try {
    const verifyItems = await FoundItems.findByIdAndUpdate(
      id,
      { request },
      { new: true }
    );

    if (!verifyItems) {
      return res
        .status(404)
        .json({ success: false, message: "Found Item  not found" });
    }

    res.json({ success: true, message: "Found item verified", verifyItems });
  } catch (error) {
    console.error("Error updating Found Items:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating Lost Items" });
  }
});
router.post(
  "/add-lostItems",
  upload.array("images"),
  authMiddleWare,
  async (req, res) => {
    const {
      userId,
      title,
      category,
      subCategory,
      brand,
      description,
      city,
      location,
      dateLost,
    } = req.body;

    if (!userId || !title || !category || !city || !dateLost) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      // Upload all images to Cloudinary
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer, "lost-and-found/lost-items")
      );

      const uploadResults = await Promise.all(uploadPromises);
      const imageUrls = uploadResults.map((result) => result.secure_url);

      const item = new LostItems({
        userId,
        title,
        category,
        subCategory,
        brand,
        description,
        city,
        location,
        dateLost,
        imageUrl: imageUrls,
      });

      await item.save();
      res.json({ success: true, item });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error adding item", error });
    }
  }
);
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
    res.json({ success: true, notifications });
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

    res.json({
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

    res.json({
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

router.get("/get-lostItems", authMiddleWare, async (req, res) => {
  try {
    const lostItems = await LostItems.find();
    res.json({ success: true, lostItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching items" });
  }
});
router.post("/postSavedItems", authMiddleWare, async (req, res) => {
  const { userId, itemId } = req.body;
  try {
    const savedItems = new SavedItems({
      userId,
      itemId,
    });
    await savedItems.save();
    res.json({ message: "SavedItems added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error adding SavedItems", error });
  }
});
router.get("/get-savedItems", authMiddleWare, async (req, res) => {
  try {
    const saveditems = await SavedItems.find().sort({ createdAt: -1 });
    res.json({ success: true, saveditems });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching saved items" });
  }
});
router.put("/delete-savedItems/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  try {
    const saveditems = await SavedItems.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching saved items" });
  }
});
router.put("/delete-displayItems/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  try {
    const saveditems = await SavedItems.findByIdAndUpdate(
      id,
      { isDeletedFromDisplayed: true },
      { new: true }
    );
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching saved items" });
  }
});
router.put("/save-item/:id", authMiddleWare, async (req, res) => {
  const { id } = req.params;
  const { isSaved } = req.body;

  try {
    const saved = await SavedItems.findByIdAndUpdate(
      id,
      { isSaved: isSaved },
      { new: true }
    );

    if (!saved) {
      return res
        .status(404)
        .json({ success: false, message: "Saved Item Not Found" });
    }

    res.json({ success: true, message: "Item Saved Status  updated", saved });
  } catch (error) {
    console.error("Error updating  status of Saved items:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating Saved Items status" });
  }
});

module.exports = router;
