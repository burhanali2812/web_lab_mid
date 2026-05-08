const express = require("express");
const FoundItems = require("../model/FoundItems");
const authMiddleWare = require("../middleWare/authMiddleWare");

const multer = require("multer");
const router = express.Router();

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

router.get("/search-found", authMiddleWare, async (req, res) => {
  try {
    const { city, category } = req.query;
    let query = {};

    if (city) query.city = new RegExp(city, "i");
    if (category) query.category = new RegExp(category, "i");

    const foundItems = await FoundItems.find(query);

    res.status(200).json({ success: true, foundItems });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error searching in found items" });
  }
});
router.get("/get-foundItems", authMiddleWare, async (req, res) => {
  try {
    const foundItems = await FoundItems.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, foundItems });
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
    res.status(200).json({ success: true, foundItems });
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
    res.status(200).json({ success: true, foundItem });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching item" });
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
      res.status(201).json({ success: true, item });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error adding item", error });
    }
  }
);
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

    res.status(200).json({ success: true, message: "Found item verified", verifyItems });
  } catch (error) {
    console.error("Error updating Found Items:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating Lost Items" });
  }
});

module.exports = router;