// server.js

const express = require("express");
const path = require("path");

// ===== IMPORT TRADES SERVICE =====
const {
  getAllTrades,
  createTrade,
  findTradeById,
  updateTrade,
  deleteTrade
} = require("./tradesService");

// ===== IMPORT TRADES HELPERS =====

const {
  addDaysPassedToTrade,
  getDaysPassed,
  getTradesMinMaxDates
} = require("./tradesHelpers");


// ===== IMPORT IMAGE HANDLERS =====
const { uploadTradeImage, deleteTradeImage } = require("./tradesImages");

// ===== IMPORT FILTER FUNCTIONS =====
const {
  getAvailableFilters,
  filterByDate,
  filterByVerified,
  filterByTickers,
  filterByTradeTypes,
  filterByDaysOfWeek,
  sortTradesByDate
} = require("./tradesFilters");

const crypto = require("crypto"); // still needed for highs
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== ROUTES =====

// GET all trades
app.get("/trades", (req, res) => {
  const trades = getAllTrades();
  console.log("GET /trades called, returning", trades.length, "trades");
  res.json(trades);
});

// POST new trade
app.post("/trades", (req, res) => {
  const newTrade = createTrade(req.body);
  console.log("POST /trades added trade:", newTrade.id);
  res.status(201).json(newTrade);
});

// DELETE a trade by ID
app.delete("/trades/:id", (req, res) => {
  const deletedTrade = deleteTrade(req.params.id);
  if (!deletedTrade) return res.status(404).json({ error: "Trade not found" });
  console.log("Trade deleted:", deletedTrade.id);
  res.status(200).json({ message: "Trade deleted", id: deletedTrade.id });
});

// UPDATE a trade
app.put("/update_trade/:id", (req, res) => {
  const updatedTrade = updateTrade(req.params.id, req.body);
  if (!updatedTrade) return res.status(404).json({ error: "Trade not found" });
  console.log(`Updated trade ${req.params.id}:`, req.body);
  res.status(200).json(updatedTrade);
});


// POST new high price to a trade
app.post("/trades/:id/high", (req, res) => {
  const tradeId = req.params.id.trim();
  const { high_datetime, price } = req.body;

  if (!high_datetime || typeof price !== "number") {
    return res.status(400).json({
      error: "Missing or invalid high_datetime or price"
    });
  }

  const parsedDate = new Date(high_datetime);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      error: "Invalid high_datetime format"
    });
  }

  const trade = findTradeById(tradeId);
  if (!trade) {
    return res.status(404).json({ error: "Trade not found" });
  }

  if (!trade.option_price_highs) {
    trade.option_price_highs = [];
  }

  // 1️⃣ Create the high (clean, no derived fields)
  const newHigh = {
    id: crypto.randomUUID(),
    high_datetime: parsedDate.toISOString(),
    price
  };

  // 2️⃣ Persist trade FIRST
  trade.option_price_highs.push(newHigh);
  updateTrade(tradeId, trade);

  // 3️⃣ Compute days_passed ONLY for response
  const days_passed = getDaysPassed(
    trade.trade_datetime,
    newHigh.high_datetime
  );

  // 4️⃣ Return enriched response
  const responseHigh = {
    ...newHigh,
    days_passed
  };

  console.log(`Added high price to trade ${tradeId}:`, responseHigh);
  res.status(201).json(responseHigh);
});


// ===== MASTER FILTER ENDPOINT WITH LOGGING =====
app.post("/trades/filtered", (req, res) => {
  const {
    startDate,
    endDate,
    verified,
    tickers,
    tradeTypes,
    daysOfWeek,
    sortOrder
  } = req.body;

  let trades = getAllTrades();
  console.log(`Starting with ${trades.length} trades`);

  trades.forEach(trade => {
    addDaysPassedToTrade(trade);
  });

  const tradesMinMaxDates = getTradesMinMaxDates(trades);

  const availableFilters = getAvailableFilters(trades);

  trades = filterByDate(trades, startDate, endDate);
  trades = filterByVerified(trades, verified);
  trades = filterByTickers(trades, tickers);
  trades = filterByTradeTypes(trades, tradeTypes);
  trades = filterByDaysOfWeek(trades, daysOfWeek);
  trades = sortTradesByDate(trades, sortOrder);

  res.json({
    trades,
    availableFilters,
    tradesMinMaxDates
  });
});



// ===== IMAGE ROUTES =====
app.post('/trades/:tradeId/image', uploadTradeImage);
app.delete('/trades/:tradeId/image', deleteTradeImage);

// DEBUG route
app.get("/debug-trades", (req, res) => {
  const trades = getAllTrades();
  res.json(trades.map(t => t.id));
});

// START SERVER
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
