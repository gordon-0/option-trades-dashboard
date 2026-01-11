// tradesHelpers.js

function getTradesMinMaxDates(trades) {
  const dates = trades
    .map(t => t.trade_datetime)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d));

  if (!dates.length) {
    return { min: null, max: null };
  }

  return {
    min: new Date(Math.min(...dates)).toISOString(),
    max: new Date(Math.max(...dates)).toISOString()
  };
}

function getDaysPassed(tradeDatetime, highDatetime) {
  if (!tradeDatetime || !highDatetime) return null;

  const tradeDate = new Date(tradeDatetime);
  const highDate = new Date(highDatetime);

  if (isNaN(tradeDate) || isNaN(highDate)) return null;

  const diffMs = highDate - tradeDate;
  return Math.max(
    0,
    Math.floor(diffMs / (1000 * 60 * 60 * 24))
  );
}


// ===== Calculate days passed =====
function addDaysPassedToTrade(trade) {
  if (!trade.trade_datetime || !trade.option_price_highs) return;

  trade.option_price_highs.forEach(high => {
    high.days_passed = getDaysPassed(
      trade.trade_datetime,
      high.high_datetime
    );
  });
}


// ===== Determine if a trade is a swing-day trade =====
function isSwingDayTrade(trade) {
    if (!trade.option_price_highs?.length || !trade.trade_datetime) return false;

    const entryDay = new Date(trade.trade_datetime).toDateString();
    return trade.option_price_highs.some(high => {
        if (!high.high_datetime) return false;
        const highDay = new Date(high.high_datetime).toDateString();
        return highDay === entryDay;
    });
}

// ===== Get trade types =====
function getTradeTypes(trade) {
    if (!trade.trade_datetime || !trade.expire_datetime) return [];

    const types = [];
    const entryDay = new Date(trade.trade_datetime).toDateString();
    const expireDay = new Date(trade.expire_datetime).toDateString();

    if (entryDay === expireDay) {
        types.push("0dte");
    } else {
        types.push("swing");
        if (isSwingDayTrade(trade)) types.push("swing-day");
    }

    return types;
}

module.exports = {
    getTradeTypes,
    isSwingDayTrade,
    getDaysPassed,
    addDaysPassedToTrade,
    getTradesMinMaxDates
};
