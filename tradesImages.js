// tradesImages.js

const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const { findTradeById, updateTrade } = require("./tradesService");

// ===== MULTER STORAGE =====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const tradeId = req.params.tradeId;
    const trade = findTradeById(tradeId);
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

    // Ticker, Strike, Average entry, Type
    const ticker = trade.ticker;
    const strike = trade.strike_price;
    const avgEntry = trade.average_entry.toString().replace('.', '-');
    const type = trade.option_type.toLowerCase() === 'call' ? 'C' : 'P';

    // Upload timestamp YYYYMMDDHHMMSS
    const now = new Date();
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const ext = path.extname(file.originalname);

    const filename = `${formattedDate}_${formattedTime}_${ticker}_${strike}_${avgEntry}_${type}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

// ===== UPLOAD HANDLER =====
function uploadTradeImage(req, res) {
  upload.single('image')(req, res, function(err) {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const tradeId = req.params.tradeId;
    const imageUrl = `/uploads/${req.file.filename}`;

    const trade = findTradeById(tradeId);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    if (!trade.images) trade.images = [];
    trade.images.push(imageUrl);

    updateTrade(tradeId, trade);

    console.log(`Uploaded image ${req.file.filename} for trade ${tradeId}`);
    res.json({ url: imageUrl });
  });
}

// ===== DELETE HANDLER =====
function deleteTradeImage(req, res) {
  const tradeId = req.params.tradeId;
  const { imageUrl } = req.body;

  if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl in request body" });

  const trade = findTradeById(tradeId);
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  if (trade.images) trade.images = trade.images.filter(url => url !== imageUrl);

  try {
    const filePath = path.join(__dirname, imageUrl.replace(/^\/+/, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Error deleting file:", err);
  }

  updateTrade(tradeId, trade);

  console.log(`Deleted image record from trade ${tradeId}: ${imageUrl}`);
  res.status(200).json({ message: "Image deleted", imageUrl });
}

module.exports = {
  uploadTradeImage,
  deleteTradeImage
};
