// js/logic/tradeFilters.js

/**
 * Helper to check if two dates are on the same calendar day
 */
function isSameDay(d1, d2) {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Filter trades by type: "0dte", "swing-day", "swing", or "all"
 */
export function filterByTradeType(trades, type) {
    if (!type || type === "all") return trades;

    return trades.filter(trade => {
        const tradeDate = new Date(trade.date);
        const expireDate = new Date(trade.expire_date);

        const is0DTE = isSameDay(tradeDate, expireDate);
        const hasHighs = trade.high_prices?.length > 0;
        let isSwingDay = false;

        if (hasHighs) {
            const highestHigh = trade.high_prices.reduce((max, h) => h.price > max.price ? h : max, trade.high_prices[0]);
            isSwingDay = isSameDay(new Date(highestHigh.date), tradeDate);
        }

        // Determine trade type
        const tradeType = is0DTE ? "0dte" : isSwingDay ? "swing-day" : "swing";

        return type === tradeType;
    });
}


/**
 * Filter trades by date range
 */
export function filterByDate(trades, startDate, endDate) {
    return trades.filter(t => {
        const tradeDate = new Date(t.date);
        if (startDate && tradeDate < startDate) return false;
        if (endDate && tradeDate > endDate) return false;
        return true;
    });
}

/**
 * Filter trades by day of week
 */
export function filterByDay(trades, selectedDays, getDayName) {
    if (!selectedDays?.length) return trades;
    return trades.filter(t => selectedDays.includes(getDayName(t.date)));
}

/**
 * Filter trades by ticker
 */
export function filterByTicker(trades, selectedTickers) {
    if (!selectedTickers?.length) return trades;
    return trades.filter(t => selectedTickers.includes(t.ticker));
}

/**
 * Filter trades by verified status
 */
export function filterByVerified(trades, verified) {
    if (verified === "all") return trades;
    return trades.filter(t => (verified === "verified" ? t.verified : !t.verified));
}

/**
 * Filter high prices for a trade
 */
export function filterHighs(trade, { maxHighTime, maxDaysPassed, maxGainPercent }) {
    if (!trade.high_prices) return [];
    return trade.high_prices.filter(h => {
        const tradeDate = new Date(trade.date);
        const highDate = new Date(h.date);
        const daysDiff = Math.floor((highDate - tradeDate) / (1000*60*60*24));
        return (!maxHighTime || h.time <= maxHighTime) &&
               (isNaN(maxGainPercent) || calculatePercentFromPrice(trade, h.price) <= maxGainPercent) &&
               (!maxDaysPassed || daysDiff <= maxDaysPassed);
    });
}



/**
 * Main function to apply all filters
 */
export function filterTrades(trades, options) {
    let result = trades;
    result = filterByDate(result, options.startDate, options.endDate);
    result = filterByDay(result, options.selectedDays, options.getDayName);
    result = filterByTicker(result, options.selectedTickers);
    result = filterByVerified(result, options.verified);
    result = filterByTradeType(result, options.tradeType);

    // Filter highs for each trade
    return result.map(t => filterHighs(t, options));
}
