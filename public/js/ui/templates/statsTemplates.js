// ui/templates/statsTemplates.js

import {
  formatPL
} from "../../logic/helpers.js";

export function renderStatTotalsTemplate({
  totalProfit,
  totalPercent,
  winRatio,
  weightedWinRatio,
  calls,
  puts,
  winTradeCount,
  lossTradeCount,

  avgProfitPerTrade,
  medianProfitPerTrade,
  avgProfitPerTradePercent,
  medianProfitPerTradePercent
}) {
  const winClass = winRatio >= 50 ? "profit-green" : "loss-red";
  const weightedClass =
    weightedWinRatio >= 50 ? "profit-green" : "loss-red";

  const totalPL = formatPL({
    dollars: totalProfit,
    percent: totalPercent
  });

  const avgPL = formatPL({
    dollars: avgProfitPerTrade,
    percent: avgProfitPerTradePercent
  });

    const medianPL = formatPL({
    dollars: medianProfitPerTrade,
    percent: medianProfitPerTradePercent
  });




  return `
    <div class="stat">
      <span class="stat__title">TOTAL P/L:</span>
      <span class="stat__value return ${totalPL.plClass}">
        ${totalPL.dollars} ${totalPL.percent}
      </span>
    </div>

    <div class="stats-row">
      <div class="stat">
        <span class="stat__title">WIN RATIO:</span>
        <span class="stat__value ${winClass}">
          ${winRatio.toFixed(2)}%
        </span>
      </div>

      <div class="stat">
        <span class="stat__title">WEIGHTED WIN RATIO:</span>
        <span class="stat__value ${weightedClass}">
          ${weightedWinRatio.toFixed(2)}%
        </span>
      </div>
    </div>

    <div class="stat">
      <span class="stat__title">Total Trades:</span>
      <span class="stat__value"><strong>${calls + puts}</strong></span>
    </div>

    <div class="stats-row">
      <div class="stat">
        <span class="stat__title">Calls:</span>
        <span class="stat__value"><strong>${calls}</strong></span>
      </div>

      <div class="stat">
        <span class="stat__title">Puts:</span>
        <span class="stat__value"><strong>${puts}</strong></span>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat">
        <span class="stat__title">Wins:</span>
        <span class="stat__value"><strong>${winTradeCount}</strong></span>
      </div>

      <div class="stat">
        <span class="stat__title">Losses:</span>
        <span class="stat__value"><strong>${lossTradeCount}</strong></span>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat">
        <span class="stat__title">Average Profit Per Trade:</span>
        <span class="stat__value ${avgPL.plClass}">
          ${avgPL.dollars} ${avgPL.percent}
        </span>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat">
        <span class="stat__title">Median Profit Per Trade:</span>
        <span class="stat__value ${medianPL.plClass}">
          ${medianPL.dollars} ${medianPL.percent}
        </span>
      </div>
    </div>
  `;
}


export function renderStatsTemplate({
  swings,
  swingsDay,
  zeroDTE,
  avgMs,
  avgHL,
  medianMs,
  medianHL,
  tradesByDay,
  plByDayBought,
  plByDaySold,
  renderTradesCountByDay,
  renderTradesWinLossByDay,
  renderPLByDay
}) {
  return `
    <div class="stats-row">
      <div class="stat">
        <span class="stat__title">Swing Trades:</span>
        <span class="stat__value"><strong>${swings}</strong></span>
      </div>

      <div class="stat">
        <span class="stat__title">Swing → Day:</span>
        <span class="stat__value"><strong>${swingsDay}</strong></span>
      </div>

      <div class="stat">
        <span class="stat__title">0DTE:</span>
        <span class="stat__value"><strong>${zeroDTE}</strong></span>
      </div>
    </div>

    <div class="stat">Avg Time Between Highs: <strong>${avgMs ?? "—"}</strong></div>
    <div class="stat">Avg High to Low: <strong>${avgHL ?? "—"}</strong></div>
    <div class="stat">Median Time Between Highs: <strong>${medianMs ?? "—"}</strong></div>
    <div class="stat">Median High to Low: <strong>${medianHL ?? "—"}</strong></div>

    <div class="dashboard-days">
      Trades by Day: ${renderTradesCountByDay(tradesByDay)}
    </div>

    <div class="dashboard-days">
      Wins/Losses by Day: ${renderTradesWinLossByDay()}
    </div>

    <div class="dashboard-days">
      P/L by Day (Bought): ${renderPLByDay(plByDayBought)}
    </div>

    <div class="dashboard-days">
      P/L by Day (Sold): ${renderPLByDay(plByDaySold)}
    </div>
  `;
}
