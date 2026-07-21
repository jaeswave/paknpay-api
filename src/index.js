require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const sessionRoutes = require("./routes/session.routes");
const attendantRoutes = require("./routes/attendant.routes");
const paymentRoutes = require("./routes/payment.routes");
const lotRoutes = require("./routes/lot.routes");
const adminRoutes = require("./routes/admin.routes");
const settlementRoutes = require("./routes/settlement.routes");
const valetRoutes = require("./routes/valet.routes");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" })); // raised for base64 receipt uploads

app.use("/api/sessions", sessionRoutes);
app.use("/api/attendants", attendantRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/valet", valetRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ParkPay API is running", timestamp: new Date() });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => console.error("MongoDB connection error:", err));
