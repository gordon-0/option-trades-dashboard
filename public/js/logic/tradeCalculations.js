// src/helpers/tradeCalculations.js
import { getDayName, calculateAverage, calculateMedian, calculatePercentFromPrice } from "./helpers.js"; // existing helper functions

/**
 * Filter trades by date
 */
export function filterByDate(trade, startDate, endDate) {
    if (!trade.tradeDateTime) return false;

    const tradeDay = trade.tradeDateTime;
    const tradeUTCYear = tradeDay.getUTCFullYear();
    const tradeUTCMonth = tradeDay.getUTCMonth();
    const tradeUTCDate = tradeDay.getUTCDate();
    const normalizedTradeDayUTC = new Date(Date.UTC(tradeUTCYear, tradeUTCMonth, tradeUTCDate));

    const startUTC = startDate
        ? new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
        : null;

    const endUTC = endDate
        ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))
        : null;

    return (!startUTC || normalizedTradeDayUTC >= startUTC) &&
           (!endUTC || normalizedTradeDayUTC <= endUTC);
}

/**
 * Filter trades by day of week
 */
export function filterByDay(trade, selectedDays) {
    if (!selectedDays.length) return true;
    const dayName = getDayName(trade.tradeDateTime);
    return selectedDays.includes(dayName);
}

/**
 * Filter trades by ticker
 */
export function filterByTicker(trade, selectedTickers) {
    if (!selectedTickers.length) return true;
    return selectedTickers.includes(trade.ticker);
}

/**
 * Filter trades by verification status
 */
export function filterByVerified(trade, verified) {
    if (verified === "all") return true;
    if (verified === "verified") return trade.verified;
    if (verified === "unverified") return !trade.verified;
    return true;
}

/**
 * Filter trades by trade type
 */
export function filterByTradeType(trade, selectedTradeTypes, getTradeTypesFn) {
    if (!selectedTradeTypes.length) return true;
    const tradeTypes = getTradeTypesFn(trade);
    return selectedTradeTypes.some(type => tradeTypes.includes(type));
}

/**
 * Calculate P/L for a trade
 */
export function calculatePL(trade, state, getHighestHighPriceFn, getFilteredHighsFn) {
    if (trade.treatAsLoss) return { dollars: -trade.avgEntry * 100, percent: -100 };

    let high;
    if (trade.highOverrideId) {
        high = trade.optionPriceHighs.find(h => h.id === trade.highOverrideId);
    }

    if (!high) {
        high = getHighestHighPriceFn(getFilteredHighsFn(trade));
    }

    if (!high) {
        const lossPercent = -state.percentLossModifier;
        const dollars = (lossPercent / 100) * trade.avgEntry * 100;
        return { dollars, percent: lossPercent };
    }

    const dollars = (high.price - trade.avgEntry) * 100;
    const percent = ((high.price - trade.avgEntry) / trade.avgEntry) * 100;

    return { dollars, percent };
}

/**
 * Count trades by day
 */
export function countTradesByDay(trades, getDayNameFn = getDayName) {
    const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    trades.forEach(t => {
        const day = getDayNameFn(t.tradeDateTime);
        if (days[day] !== undefined) days[day]++;
    });
    return days;
}

/**
 * Count wins/losses by day
 */
export function countWinsLossesByDay(trades, plByTradeId, getDayNameFn = getDayName) {
    const days = { Monday: { wins: 0, losses: 0 }, Tuesday: { wins: 0, losses: 0 }, Wednesday: { wins: 0, losses: 0 }, Thursday: { wins: 0, losses: 0 }, Friday: { wins: 0, losses: 0 } };
    trades.forEach(t => {
        const day = getDayNameFn(t.tradeDateTime);
        if (!days[day]) return;

        const { dollars } = plByTradeId.get(t.id);

        if (!t.treatAsLoss && dollars > 0) {
            days[day].wins++;
        } else {
            days[day].losses++;
        }
    });
    return days;
}

/**
 * Calculate option high time differences
 */
export function getOptionHighTimeDiffs(trades, getFilteredHighsFn) {
    return trades.reduce(
        (acc, trade) => {
            const highs = getFilteredHighsFn(trade);
            if (highs.length < 2) return acc;

            const chronTimes = highs.map(h => h.highDateTime).sort((a, b) => a - b);

            for (let i = 1; i < chronTimes.length; i++) {
                acc.high.push(Math.abs(chronTimes[i] - chronTimes[i - 1]));
            }

            const [max, min] = [...highs].sort((a, b) => b.price - a.price).slice(0, 2).map(h => h.highDateTime);
            if (max && min) acc.highLow.push(Math.abs(max - min));

            return acc;
        },
        { high: [], highLow: [] }
    );
}

/**
 * Calculate average/median times
 */
export function calculateOptionHighTimeStats(trades, getFilteredHighsFn) {
    const { high, highLow } = getOptionHighTimeDiffs(trades, getFilteredHighsFn);

    return {
        high: { avg: calculateAverage(high), median: calculateMedian(high) },
        highLow: { avg: calculateAverage(highLow), median: calculateMedian(highLow) }
    };
}
