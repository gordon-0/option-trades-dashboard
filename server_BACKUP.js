// server.js

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const app = express();
const PORT = 3000;

const tradesFile = path.join(__dirname, "data", "trades.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== READ / WRITE =====
function readTrades() {
  if (!fs.existsSync(tradesFile)) return [];
  const data = fs.readFileSync(tradesFile, "utf-8");
  return JSON.parse(data);
}

function writeTrades(trades) {
  fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
}

// ===== MULTER STORAGE WITH CUSTOM FILENAME =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const tradeId = req.params.tradeId;
    const trades = readTrades();
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) return cb(new Error('Trade not found'));

    const tradeDate = new Date(trade.trade_datetime);
    const pad = n => n.toString().padStart(2, '0');

    // YYYY-MM-DD
    const formattedDate = `${tradeDate.getFullYear()}-${pad(tradeDate.getMonth()+1)}-${pad(tradeDate.getDate())}`;

    // HHMMAM/PM
    let hours = tradeDate.getHours();
    const minutes = pad(tradeDate.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const formattedTime = `${pad(hours)}${minutes}${ampm}`;

    // Ticker
    const ticker = trade.ticker;

    // Strike
    const strike = trade.strike_price;

    // Average entry
    const avgEntry = trade.average_entry.toString().replace('.', '-');

    // Call/Put
    const type = trade.option_type.toLowerCase() === 'call' ? 'C' : 'P';

    // Upload timestamp YYYYMMDDHHMMSS
    const now = new Date();
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // File extension
    const ext = path.extname(file.originalname);

    const filename = `${formattedDate}_${formattedTime}_${ticker}_${strike}_${avgEntry}_${type}_${timestamp}${ext}`;

    cb(null, filename);
  }
});

const upload = multer({ storage });

// ===== GET all trades =====
app.get("/trades", (req, res) => {
  const trades = readTrades();
  console.log("GET /trades called, returning", trades.length, "trades");
  res.json(trades);
});

// ===== POST new trade =====
app.post("/trades", (req, res) => {
  const trades = readTrades();

  const newTrade = { id: crypto.randomUUID(), option_price_highs: [], ...req.body };

  trades.push(newTrade);
  writeTrades(trades);

  console.log("POST /trades added trade:", newTrade.id);
  res.status(201).json(newTrade);
});

// ===== DELETE a trade by ID =====
app.delete("/trades/:id", (req, res) => {
  const tradeId = req.params.id.trim();
  const trades = readTrades();

  const index = trades.findIndex(t => String(t.id).trim() === tradeId);
  if (index === -1) return res.status(404).json({ error: "Trade not found" });

  const deletedTrade = trades.splice(index, 1)[0];
  writeTrades(trades);

  console.log("Trade deleted:", deletedTrade.id);
  res.status(200).json({ message: "Trade deleted", id: deletedTrade.id });
});

// ===== POST new high price to a trade =====
app.post("/trades/:id/high", (req, res) => {
  const tradeId = req.params.id.trim();
  const { high_datetime, price } = req.body;

  if (!high_datetime || typeof price !== "number") {
    return res.status(400).json({ error: "Missing or invalid high_datetime or price" });
  }

  const parsedDate = new Date(high_datetime);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: "Invalid high_datetime format" });
  }

  const trades = readTrades();
  const trade = trades.find(t => String(t.id).trim() === tradeId);
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  if (!trade.option_price_highs) trade.option_price_highs = [];

  const newHigh = {
    id: crypto.randomUUID(),
    high_datetime: parsedDate.toISOString(),
    price
  };

  trade.option_price_highs.push(newHigh);
  writeTrades(trades);

  console.log(`Added high price to trade ${tradeId}:`, newHigh);
  res.status(201).json(newHigh);
});

// ===== UPDATE a trade =====
app.put("/update_trade/:id", (req, res) => {
  const tradeId = req.params.id.trim();
  const updates = req.body;

  const trades = readTrades();
  const trade = trades.find(t => String(t.id).trim() === tradeId);
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  Object.assign(trade, updates);
  writeTrades(trades);

  console.log(`Updated trade ${tradeId}:`, updates);
  res.status(200).json(trade);
});

// ===== UPLOAD IMAGE =====
app.post('/trades/:tradeId/image', (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const tradeId = req.params.tradeId;
    const imageUrl = `/uploads/${req.file.filename}`;

    // Update JSON
    const trades = readTrades();
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    if (!trade.images) trade.images = [];
    trade.images.push(imageUrl);

    writeTrades(trades);

    console.log(`Uploaded image ${req.file.filename} for trade ${tradeId}`);
    res.json({ url: imageUrl });
  });
});


// ===== DELETE an image from a trade =====
app.delete('/trades/:tradeId/image', (req, res) => {
  const tradeId = req.params.tradeId;
  const { imageUrl } = req.body; // Expect full URL path like "/uploads/filename.png"

  if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl in request body" });

  const trades = readTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  if (!trade.images || !trade.images.includes(imageUrl)) {
    // Just warn instead of failing
    console.warn(`Image not found in trade ${tradeId}:`, imageUrl);
  }

  // Remove image from array if it exists
  if (trade.images) {
    trade.images = trade.images.filter(url => url !== imageUrl);
  }

  // Delete file from disk safely
  try {
    const filePath = path.join(__dirname, imageUrl.replace(/^\/+/, '')); // remove leading slash
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file from disk: ${filePath}`);
    } else {
      console.warn(`File does not exist on disk, skipping delete: ${filePath}`);
    }
  } catch (err) {
    console.error("Error deleting file from disk:", err);
  }

  // Save updated trades
  writeTrades(trades);

  console.log(`Deleted image record from trade ${tradeId}: ${imageUrl}`);
  res.status(200).json({ message: "Image deleted", imageUrl });
});



// ===== DEBUG ROUTE =====
app.get("/debug-trades", (req, res) => {
  const trades = readTrades();
  res.json(trades.map(t => t.id));
});

// ===== START SERVER =====
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
