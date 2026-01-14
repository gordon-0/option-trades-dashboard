import {
    getDayName,
    calculateAverage,
    calculateMedian
} from "./helpers.js";

/* -------------------------
   Totals / Outcomes
-------------------------- */

export function calculateTradeTotals(trades, plByTradeId) {
    let profit = 0;
    let cost = 0;

    for (const trade of trades) {
        const { dollars } = plByTradeId.get(trade.id);
        profit += dollars;
        cost += trade.avgEntry * 100;
    }

    return {
        profit,
        cost,
        percent: cost ? (profit / cost) * 100 : 0
    };
}

export function calculateTradeOutcomes(trades, plByTradeId) {
    let wins = 0;
    let losses = 0;

    for (const trade of trades) {
        const { dollars } = plByTradeId.get(trade.id);
        if (!trade.treatAsLoss && dollars > 0) wins++;
        else losses++;
    }

    return { wins, losses };
}

/* -------------------------
   Composition
-------------------------- */

export function calculateTradeComposition(trades, isSwingDayTrade) {
    let calls = 0;
    let puts = 0;
    let swings = 0;
    let swingsDay = 0;
    let zeroDTE = 0;

    for (const trade of trades) {
        const isSameDay =
            trade.tradeDateTime?.toDateString() ===
            trade.expireDateTime?.toDateString();

        if (trade.optionType === "call") calls++;
        if (trade.optionType === "put") puts++;

        if (isSameDay) {
            zeroDTE++;
        } else {
            swings++;
            if (!trade.treatAsLoss && isSwingDayTrade(trade)) {
                swingsDay++;
            }
        }
    }

    return { calls, puts, swings, swingsDay, zeroDTE };
}

/* -------------------------
   Day-based metrics
-------------------------- */

export function countWinsLossesByDay(trades, plByTradeId) {
    const days = {
        Monday: { wins: 0, losses: 0 },
        Tuesday: { wins: 0, losses: 0 },
        Wednesday: { wins: 0, losses: 0 },
        Thursday: { wins: 0, losses: 0 },
        Friday: { wins: 0, losses: 0 }
    };

    trades.forEach(t => {
        const day = getDayName(t.tradeDateTime);
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

export function countTradesByDay(trades) {
    const days = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0
    };

    trades.forEach(t => {
        const day = getDayName(t.tradeDateTime);
        if (days[day] !== undefined) days[day]++;
    });

    return days;
}

export function calcPlByDayBought(trades, plByTradeId) {
    const daysPL = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0
    };

    trades.forEach(t => {
        const day = getDayName(t.tradeDateTime);
        if (daysPL[day] === undefined) return;

        const pl = plByTradeId.get(t.id);
        if (!pl) return;

        daysPL[day] += pl.dollars;
    });

    return daysPL;
}

export function calcPlByDaySold(trades, plByTradeId, getFilteredHighs, getHighestHighPrice) {
    const daysPL = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0
    };

    trades.forEach(t => {
        const pl = plByTradeId.get(t.id);
        if (!pl) return;

        const highs = getFilteredHighs(t);
        const selectedHigh = getHighestHighPrice(highs);

        const day = selectedHigh?.highDateTime
            ? getDayName(selectedHigh.highDateTime)
            : getDayName(t.expireDateTime || t.tradeDateTime);

        if (daysPL[day] !== undefined) {
            daysPL[day] += pl.dollars;
        }
    });

    return daysPL;
}

/* -------------------------
   Win ratios
-------------------------- */

export function calculateWinRatios(metrics, plByTradeId) {
    const { winLossByDay } = metrics;

    const { wins, losses } = Object.values(winLossByDay).reduce(
        (acc, d) => ({
            wins: acc.wins + d.wins,
            losses: acc.losses + d.losses
        }),
        { wins: 0, losses: 0 }
    );

    const totalTrades = wins + losses;
    const winRatio = totalTrades ? (wins / totalTrades) * 100 : 0;

    let totalAbsPL = 0;
    let positivePL = 0;

    plByTradeId.forEach(({ dollars }) => {
        totalAbsPL += Math.abs(dollars);
        if (dollars > 0) positivePL += dollars;
    });

    const weightedWinRatio = totalAbsPL
        ? (positivePL / totalAbsPL) * 100
        : 0;

    return { winRatio, weightedWinRatio };
}