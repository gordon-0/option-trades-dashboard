// tradesFilters.js

const { calculateDaysPassed, getTradeTypes } = require("./tradesHelpers");


function getAvailableFilters(trades) {
    const tickersSet = new Set();
    const tradeTypesSet = new Set();
    const daysSet = new Set();

    // Define week order here once
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    trades.forEach(trade => {
        if (trade.ticker) tickersSet.add(trade.ticker.toUpperCase());

        const types = getTradeTypes(trade);
        types.forEach(t => tradeTypesSet.add(t));

        if (trade.trade_datetime) {
            const jsDayIndex = new Date(trade.trade_datetime).getDay(); // 0 = Sunday, 1 = Monday ...
            // Convert JS index to our Monday-first day name
            const dayName = dayNames[(jsDayIndex + 6) % 7]; // Sunday (0) → last in array
            daysSet.add(dayName);
        }
    });

    const sortedDays = dayNames.filter(day => daysSet.has(day));

    const daysPassed = calculateDaysPassed(trades);

    return {
        tickers: Array.from(tickersSet).sort(),
        tradeTypes: Array.from(tradeTypesSet).sort(),
        daysOfWeek: sortedDays,
        daysPassed
    };
}





// ===== FILTER BY DATE =====
function filterByDate(trades, startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  return trades.filter(trade => {
    if (!trade.trade_datetime) return false;
    const tradeDate = new Date(trade.trade_datetime);
    return (!start || tradeDate >= start) &&
           (!end || tradeDate <= end);
  });
}

// ===== FILTER BY VERIFIED =====
function filterByVerified(trades, verified) {
  if (!verified || verified === "all") return trades;

  return trades.filter(trade => {
    if (verified === "verified") return trade.verified === true;
    if (verified === "unverified") return trade.verified === false;
    return true; // fallback, should never hit
  });
}


// ===== FILTER BY TICKERS =====
function filterByTickers(trades, tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return trades;
  }

  // Normalize once for safety
  const tickerSet = new Set(
    tickers
      .filter(Boolean)
      .map(t => String(t).toUpperCase())
  );

  return trades.filter(trade => {
    if (!trade.ticker) return false;
    return tickerSet.has(String(trade.ticker).toUpperCase());
  });
}


// ===== FILTER BY TRADE TYPES =====
function filterByTradeTypes(trades, tradeTypes) {
  if (!tradeTypes?.length) return trades;

  return trades.filter(trade => {
    if (!trade.trade_datetime || !trade.expire_datetime) return false;

    const entryDay = new Date(trade.trade_datetime).toDateString();
    const expireDay = new Date(trade.expire_datetime).toDateString();

    const types = [];

    // Same-day expiry → 0DTE
    if (entryDay === expireDay) {
      types.push("0dte");
    } else {
      // Multi-day trade → swing
      types.push("swing");

      // If trade had a high on entry day → swing-day
      if (trade.option_price_highs?.length) {
        const swingDayHigh = trade.option_price_highs.some(h => {
          if (!h.high_datetime) return false;
          const highDay = new Date(h.high_datetime).toDateString();
          return highDay === entryDay;
        });
        if (swingDayHigh) types.push("swing-day");
      }
    }

    // Check if any of the trade's types match the filter
    return tradeTypes.some(type => types.includes(type));
  });
}

// ===== FILTER BY DAYS OF WEEK =====
function filterByDaysOfWeek(trades, selectedDays = []) {
    // If no days selected, include all trades
    if (!selectedDays.length) return trades;

    return trades.filter(trade => {
        if (!trade.trade_datetime) return false; // skip invalid dates

        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const tradeDay = dayNames[new Date(trade.trade_datetime).getDay()];

        return selectedDays.includes(tradeDay);
    });
}


// ===== Sort By Date =====
function sortTradesByDate(trades, sortOrder = "newest") {
    return trades.slice().sort((a, b) => {
        const dateA = a.trade_datetime instanceof Date ? a.trade_datetime : new Date(a.trade_datetime);
        const dateB = b.trade_datetime instanceof Date ? b.trade_datetime : new Date(b.trade_datetime);

        if (sortOrder === "oldest") {
            return dateA - dateB;
        } else {
            // default "newest"
            return dateB - dateA;
        }
    });
}



// ===== EXPORT ALL FILTERS =====
module.exports = {
  getAvailableFilters,
  filterByDate,
  filterByVerified,
  filterByTickers,
  filterByTradeTypes,
  filterByDaysOfWeek,
  sortTradesByDate
};
