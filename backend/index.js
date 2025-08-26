// index.js — minimal Express server for Render

import express from "express";
import cors from "cors";

const app = express();

// --- Middleware ---
app.use(express.json());

// While debugging, allow all origins.
// (Once it works, we can lock this down to your exact frontend domain.)
app.use(cors());

// --- Routes ---
app.get("/api/health", (req, res) => {
  res.json({ ok: true, msg: "Backend is running" });
});

// Example placeholder route you can use later:
// app.get("/api/stocks", (req, res) => {
//   const { symbol } = req.query;
//   return res.json({ symbol, price: 123.45 });
// });

// --- Start server (Render needs process.env.PORT) ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
