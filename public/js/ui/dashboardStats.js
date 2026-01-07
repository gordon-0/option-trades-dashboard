
import {
  calculatePL,
  calculateAvgTimeBetweenHighs,
  calculateAvgTimeBetweenHighLow,
  calculateMedianTimeBetweenHighs,
  calculateMedianTimeBetweenHighLow,
  formatMs
} from "../logic/tradeCalculations.js";
import { getDayName } from "../logic/tradeFilters.js";

function countTradesByDay(trades) {
  const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
  trades.forEach(t => {
    const d = getDayName(t.date);
    if (days[d] !== undefined) days[d]++;
  });
  return days;
}

function plByDay(trades, sellIndex, filters) {
  const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
  trades.forEach(t => {
    const day = getDayName(t.date);
    if (days[day] === undefined) return;
    days[day] += calculatePL(t, sellIndex, filters).dollars;
  });
  return days;
}

function plByDaySold(trades, sellIndex, filters) {
  const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };

  trades.forEach(t => {
    if (t.treatAsLoss) return;

    if (t.overrideHighPrice) {
      const d = getDayName(t.overrideHighPrice.date);
      if (days[d] !== undefined) {
        days[d] += (t.overrideHighPrice.price - t.avg) * 100;
      }
      return;
    }

    let highs = [...(t.high_prices || [])];

    if (filters.maxHighTime) {
      highs = highs.filter(h => h.time <= filters.maxHighTime);
    }

    if (!isNaN(filters.maxDaysPassed)) {
      const td = new Date(t.date);
      highs = highs.filter(h =>
        (new Date(h.date) - td) / 86400000 <= filters.maxDaysPassed
      );
    }

    highs.sort((a, b) => b.price - a.price);
    const h = highs[Math.min(sellIndex, highs.length - 1)];
    if (!h) return;

    const d = getDayName(h.date);
    if (days[d] !== undefined) {
      days[d] += (h.price - t.avg) * 100;
    }
  });

  return days;
}

export function renderStats(container, trades, sellIndex, filters) {
  const statTrades = trades.filter(t => !t.excluded);

  let totalProfit = 0, totalCost = 0;
  let calls = 0, puts = 0, swings = 0, swingsDay = 0, zeroDTE = 0;

  statTrades.forEach(t => {
    const { dollars } = calculatePL(t, sellIndex, filters);
    totalProfit += dollars;
    totalCost += t.avg * 100;

    if (t.option_type.toLowerCase() === "call") calls++;
    if (t.option_type.toLowerCase() === "put") puts++;

    if (t.date !== t.expire_date) {
      swings++;
      if (!t.treatAsLoss && t.high_prices?.length) {
        const highest = [...t.high_prices].sort((a, b) => b.price - a.price)[0];
        if (highest?.date === t.date) swingsDay++;
      }
    }

    if (t.date === t.expire_date) zeroDTE++;
  });

  const pct = totalCost ? (totalProfit / totalCost) * 100 : 0;
  const totalEl = container.querySelector("#total-pl-amount");
  totalEl.className = `profit ${totalProfit >= 0 ? "positive" : "negative"}`;
  totalEl.innerHTML =
    `${totalProfit >= 0 ? "+" : "-"}$${Math.abs(totalProfit).toFixed(2)} (${pct.toFixed(2)}%)`;

  // Win ratio
  const wins = statTrades.filter(
    t => !t.treatAsLoss && calculatePL(t, sellIndex, filters).dollars > 0
  ).length;
  const winRatio = statTrades.length ? (wins / statTrades.length) * 100 : 0;

  const winEl = container.querySelector("#win-ratio");
  winEl.textContent = `${winRatio.toFixed(2)}%`;
  winEl.className = `profit ${winRatio >= 50 ? "positive" : "negative"}`;

  // Weighted win ratio
  const totalAbs = statTrades.reduce(
    (s, t) => s + Math.abs(calculatePL(t, sellIndex, filters).dollars), 0
  );
  const weightedWins = statTrades.reduce((s, t) => {
    const pl = calculatePL(t, sellIndex, filters).dollars;
    return s + (pl > 0 ? pl : 0);
  }, 0);

  const weightedPct = totalAbs ? (weightedWins / totalAbs) * 100 : 0;
  container.querySelector("#weighted-win-ratio").innerHTML =
    `WEIGHTED WIN RATIO: <span class="profit ${weightedPct >= 50 ? "positive" : "negative"}">${weightedPct.toFixed(2)}%</span>`;

  container.querySelector("#calls-count").textContent = calls;
  container.querySelector("#puts-count").textContent = puts;
  container.querySelector("#trades-count").textContent = calls + puts;
  container.querySelector("#swing-count").textContent = swings;
  container.querySelector("#swing-day-count").textContent = swingsDay;
  container.querySelector("#zero-dte-count").textContent = zeroDTE;

  const avgMs = calculateAvgTimeBetweenHighs(statTrades, filters);
  const avgHL = calculateAvgTimeBetweenHighLow(statTrades, filters);
  const medMs = calculateMedianTimeBetweenHighs(statTrades, filters);
  const medHL = calculateMedianTimeBetweenHighLow(statTrades, filters);

  container.querySelector("#avg-high-time").textContent = avgMs ? formatMs(avgMs) : "—";
  container.querySelector("#avg-highlow-time").textContent = avgHL ? formatMs(avgHL) : "—";
  container.querySelector("#median-high-time").textContent = medMs ? formatMs(medMs) : "—";
  container.querySelector("#median-highlow-time").textContent = medHL ? formatMs(medHL) : "—";

  const days = countTradesByDay(statTrades);
  container.querySelector("#trades-by-day").textContent =
    "Trades by Day: " + Object.entries(days).map(([d, c]) => `${d}: ${c}`).join("  ");

  const plDay = plByDay(statTrades, sellIndex, filters);
  container.querySelector("#pl-by-day").innerHTML =
    "P/L by Day (Day bought): " +
    Object.entries(plDay).map(([d, v]) =>
      `${d}: <span class="profit ${v >= 0 ? "positive" : "negative"}">${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}</span>`
    ).join("  ");

  const plSold = plByDaySold(statTrades, sellIndex, filters);
  container.querySelector("#pl-by-day-sold").innerHTML =
    "P/L by Day (Day Sold): " +
    Object.entries(plSold).map(([d, v]) =>
      `${d}: <span class="profit ${v >= 0 ? "positive" : "negative"}">${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}</span>`
    ).join("  ");
}