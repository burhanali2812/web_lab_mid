const express = require("express");
const LostItems = require("../model/LostItems");
const authMiddleWare = require("../middleWare/authMiddleWare");
const router = express.Router();
const multer = require("multer");
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

router.get("/search-lost", authMiddleWare, async (req, res) => {
  try {
    const { city, category } = req.query;
    let query = {};

    if (city) query.city = new RegExp(city, "i");
    if (category) query.category = new RegExp(category, "i");

    const lostItems = await LostItems.find(query);

    res.status(200).json({ success: true, lostItems });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching in lost items" });
  }
});

router.get("/get-lostItems", authMiddleWare, async (req, res) => {
  try {
    const lostItems = await LostItems.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, lostItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching items" });
  }
});


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

    res.status(200).json({ success: true, message: "Lost item verified", verifyItems });
  } catch (error) {
    console.error("Error updating Lost Items:", error);
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
      res.status(201).json({ success: true, item });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error adding item", error });
    }
  }
);

router.get("/get-lostItems", authMiddleWare, async (req, res) => {
  try {
    const lostItems = await LostItems.find();
    res.status(200).json({ success: true, lostItems });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error searching items" });
  }
});


module.exports = router;