// tradesService.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const tradesFile = path.join(__dirname, "data", "trades.json");

// ===== READ =====
function readTrades() {
  if (!fs.existsSync(tradesFile)) return [];
  const data = fs.readFileSync(tradesFile, "utf-8");
  return JSON.parse(data);
}

// ===== WRITE =====
function writeTrades(trades) {
  fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
}

// ===== GET ALL =====
function getAllTrades() {
  return readTrades();
}

// ===== CREATE NEW =====
function createTrade(tradeData) {
  const trades = readTrades();
  const newTrade = { id: crypto.randomUUID(), option_price_highs: [], ...tradeData };
  trades.push(newTrade);
  writeTrades(trades);
  return newTrade;
}

// ===== FIND BY ID =====
function findTradeById(tradeId) {
  const trades = readTrades();
  return trades.find(t => String(t.id).trim() === String(tradeId).trim());
}

// ===== UPDATE =====
function updateTrade(tradeId, updates) {
  const trades = readTrades();
  const trade = trades.find(t => String(t.id).trim() === String(tradeId).trim());
  if (!trade) return null;
  Object.assign(trade, updates);
  writeTrades(trades);
  return trade;
}

// ===== DELETE =====
function deleteTrade(tradeId) {
  const trades = readTrades();
  const index = trades.findIndex(t => String(t.id).trim() === String(tradeId).trim());
  if (index === -1) return null;
  const deleted = trades.splice(index, 1)[0];
  writeTrades(trades);
  return deleted;
}

module.exports = {
  getAllTrades,
  createTrade,
  findTradeById,
  updateTrade,
  deleteTrade,
  readTrades,   // export only if you need direct access
  writeTrades   // optional
};
