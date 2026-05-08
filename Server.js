const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// Root route
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); 
  }
};


app.use("/users", require("./routes/userRoutes"));
app.use("/lost-items", require("./routes/lostItemsRoutes"));
app.use("/found-items", require("./routes/founItemsRoutes"));
app.use("/notifications", require("./routes/notificationsRoutes"));
app.use("/otp", require("./routes/otpRoutes"));

// Start server only after DB connection
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});