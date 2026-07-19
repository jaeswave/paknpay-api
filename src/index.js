require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const sessionRoutes = require("./routes/session.routes");
const attendantRoutes = require("./routes/attendant.routes");
const paymentRoutes = require("./routes/payment.routes");
const lotRoutes = require("./routes/lot.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/sessions", sessionRoutes);
app.use("/api/attendants", attendantRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ParkPay API is running", timestamp: new Date() });
});

// In your index.js
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME || "parkpaydb", // Specify DB name here
  })
  .then(() => {
    console.log(`Connected to database: ${process.env.DB_NAME || "parkpaydb"}`);
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => console.error("MongoDB connection error:", err));
