// ===== Calculate days passed =====
function calculateDaysPassed(trades) {
    const daysPassedSet = new Set();

    trades.forEach(trade => {
        if (!trade.trade_datetime || !trade.option_price_highs) return;

        const tradeDate = new Date(trade.trade_datetime);

        trade.option_price_highs.forEach(high => {
            if (!high.high_datetime) return;

            const highDate = new Date(high.high_datetime);
            const diffMs = highDate - tradeDate;
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (days >= 0) daysPassedSet.add(days);
        });
    });

    return Array.from(daysPassedSet).sort((a, b) => a - b);
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
    calculateDaysPassed,
    getTradeTypes,
    isSwingDayTrade
};
