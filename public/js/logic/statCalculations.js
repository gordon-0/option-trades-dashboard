// js/logic/statCalculations.js

import { getDayName } from './helpers.js';

/**
 * Calculate P/L for a trade based on sellIndex, maxHighTime, maxDaysPassed, maxGainPercent
 */
export function calculatePL(trade, sellIndex, maxHighTime, maxDaysPassed, maxGainPercent) {
    if (trade.treatAsLoss) {
        return { dollars: -trade.avg * 100, percent: -100 };
    }

    if (trade.overrideHighPrice) {
        const sell = trade.overrideHighPrice;
        const dollars = (sell.price - trade.avg) * 100;
        const percent = ((sell.price - trade.avg) / trade.avg) * 100;
        return { dollars, percent };
    }

    let highs = Array.isArray(trade.high_prices) ? [...trade.high_prices] : [];

    if (!isNaN(maxGainPercent)) {
        highs = highs.filter(h =>
            ((h.price - trade.avg) / trade.avg) * 100 <= maxGainPercent
        );
    }

    if (maxHighTime) {
        highs = highs.filter(h => h.time <= maxHighTime);
    }

    if (!isNaN(maxDaysPassed)) {
        const tradeDate = new Date(trade.date);
        highs = highs.filter(h => {
            const highDate = new Date(h.date);
            const daysDiff = (highDate - tradeDate) / (1000 * 60 * 60 * 24);
            return daysDiff <= maxDaysPassed;
        });
    }

    highs.sort((a, b) => b.price - a.price);

    if (!highs.length) {
        return { dollars: -trade.avg * 100, percent: -100 };
    }

    const sell = highs[Math.min(sellIndex, highs.length - 1)];
    const dollars = (sell.price - trade.avg) * 100;
    const percent = ((sell.price - trade.avg) / trade.avg) * 100;

    return { dollars, percent };
}

/**
 * Calculate percent gain/loss from price
 */
export function calculatePercentFromPrice(trade, price) {
    return ((price - trade.avg) / trade.avg) * 100;
}

/**
 * Average time between highs for filtered trades
 */
export function calculateAvgTimeBetweenHighs(trades, getFilteredHighs, filters) {
    const diffs = [];
    trades.forEach(trade => {
        const highs = Array.isArray(getFilteredHighs(trade, filters)) ? getFilteredHighs(trade, filters) : [];
        if (highs.length < 2) return;

        const times = highs
            .map(h => new Date(`${h.date} ${h.time}`))
            .sort((a, b) => a - b);

        for (let i = 1; i < times.length; i++) {
            diffs.push(times[i] - times[i - 1]);
        }
    });
    return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
}

/**
 * Average time between high and low prices
 */
export function calculateAvgTimeBetweenHighLow(trades, getFilteredHighs, filters) {
    const diffs = [];
    trades.forEach(trade => {
        const highs = Array.isArray(getFilteredHighs(trade, filters)) ? getFilteredHighs(trade, filters) : [];
        if (highs.length < 2) return;

        const sorted = [...highs].sort((a, b) => b.price - a.price);
        const tMax = new Date(`${sorted[0].date} ${sorted[0].time}`);
        const tMin = new Date(`${sorted[sorted.length - 1].date} ${sorted[sorted.length - 1].time}`);

        diffs.push(Math.abs(tMax - tMin));
    });
    return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
}

/**
 * Median time between highs
 */
export function calculateMedianTimeBetweenHighs(trades, getFilteredHighs, calculateMedian, filters) {
    const diffs = [];
    trades.forEach(trade => {
        const highs = Array.isArray(getFilteredHighs(trade, filters)) ? getFilteredHighs(trade, filters) : [];
        if (highs.length < 2) return;

        const times = highs
            .map(h => new Date(`${h.date} ${h.time}`))
            .sort((a, b) => a - b);

        for (let i = 1; i < times.length; i++) {
            diffs.push(times[i] - times[i - 1]);
        }
    });
    return calculateMedian(diffs);
}

/**
 * Median time between high and low prices
 */
export function calculateMedianTimeBetweenHighLow(trades, getFilteredHighs, calculateMedian, filters) {
    const diffs = [];
    trades.forEach(trade => {
        const highs = Array.isArray(getFilteredHighs(trade, filters)) ? getFilteredHighs(trade, filters) : [];
        if (highs.length < 2) return;

        const sorted = [...highs].sort((a, b) => b.price - a.price);
        const tMax = new Date(`${sorted[0].date} ${sorted[0].time}`);
        const tMin = new Date(`${sorted[sorted.length - 1].date} ${sorted[sorted.length - 1].time}`);

        diffs.push(Math.abs(tMax - tMin));
    });
    return calculateMedian(diffs);
}

/**
 * Count trades by day of week
 * @param {Array} trades 
 * @returns {Object} e.g. { Monday: 2, Tuesday: 0, ... }
 */
export function countTradesByDay(trades) {
    const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    trades.forEach(t => {
        const day = getDayName(t.date);
        if (days[day] !== undefined) days[day]++;
    });
    return days;
}

/**
 * Calculate P/L by day of week based on buy date
 * @param {Array} trades 
 * @param {Function} calculatePL - function(trade, sellIndex, maxHighTime, maxDaysPassed, maxGainPercent) -> { dollars, percent }
 * @param {number} sellIndex 
 * @param {Object} filters - { maxHighTime, maxDaysPassed, maxGainPercent }
 * @returns {Object} e.g. { Monday: 100, Tuesday: -50, ... }
 */
export function plByDay(trades, sellIndex, calculatePL, filters) {
    const daysPL = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    const { maxHighTime, maxDaysPassed, maxGainPercent } = filters;

    trades.forEach(t => {
        const day = getDayName(t.date);
        if (daysPL[day] !== undefined) {
            const { dollars } = calculatePL(t, sellIndex, maxHighTime, maxDaysPassed, maxGainPercent);
            daysPL[day] += dollars;
        }
    });
    return daysPL;
}

/**
 * Calculate P/L by day of week based on sell date
 * @param {Array} trades 
 * @param {Function} calculatePL - function(trade, sellIndex, maxHighTime, maxDaysPassed, maxGainPercent) -> { dollars, percent }
 * @param {number} sellIndex 
 * @param {Object} filters - { maxHighTime, maxDaysPassed }
 * @returns {Object} e.g. { Monday: 100, Tuesday: -50, ... }
 */
export function plByDaySold(trades, sellIndex, calculatePL, filters) {
    const daysPL = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    const { maxHighTime, maxDaysPassed } = filters;

    trades.forEach(t => {
        if (t.treatAsLoss) return;

        if (t.overrideHighPrice) {
            const day = getDayName(t.overrideHighPrice.date);
            if (daysPL[day] !== undefined) {
                daysPL[day] += (t.overrideHighPrice.price - t.avg) * 100;
            }
            return;
        }

        let highs = Array.isArray(t.high_prices) ? [...t.high_prices] : [];

        if (maxHighTime) highs = highs.filter(h => h.time <= maxHighTime);

        if (!isNaN(maxDaysPassed)) {
            const tradeDate = new Date(t.date);
            highs = highs.filter(h => {
                const highDate = new Date(h.date);
                const daysDiff = Math.floor((highDate - tradeDate) / (1000 * 60 * 60 * 24));
                return daysDiff <= maxDaysPassed;
            });
        }

        highs.sort((a, b) => b.price - a.price);
        const selectedHigh = highs[Math.min(sellIndex, highs.length - 1)];

        if (selectedHigh) {
            const day = getDayName(selectedHigh.date);
            if (daysPL[day] !== undefined) {
                const dollars = (selectedHigh.price - t.avg) * 100;
                daysPL[day] += dollars;
            }
        }
    });
    return daysPL;
}
