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


// ===== Calculate days passed =====
function calculateDaysPassedForTrade(trade) {
    if (!trade.trade_datetime || !trade.option_price_highs) return;

    const tradeDate = new Date(trade.trade_datetime);

    trade.option_price_highs.forEach(high => {
        if (!high.high_datetime) return;

        const highDate = new Date(high.high_datetime);
        const diffMs = highDate - tradeDate;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        high.days_passed = days >= 0 ? days : 0;
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
    calculateDaysPassedForTrade,
    getTradesMinMaxDates
};
