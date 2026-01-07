
import {
  calculatePL,
  calculatePercentFromPrice,
  formatTimeAMPM
} from "../logic/tradeCalculations.js";

export function renderTradeCards({
  container,
  trades,
  sellIndex,
  filters,
  onDelete,
  onToggleLoss,
  onToggleExclude,
  onToggleOverride,
  onAddHigh
}) {
  container.innerHTML = trades.map(trade => {
    const allHighs = trade.treatAsLoss ? [] : [...trade.high_prices];
    let validHighs = [...allHighs];

    if (!isNaN(filters.maxGainPercent)) {
      validHighs = validHighs.filter(h =>
        calculatePercentFromPrice(trade, h.price) <= filters.maxGainPercent
      );
    }

    if (filters.maxHighTime) {
      validHighs = validHighs.filter(h => h.time <= filters.maxHighTime);
    }

    if (!isNaN(filters.maxDaysPassed)) {
      const td = new Date(trade.date);
      validHighs = validHighs.filter(h =>
        (new Date(h.date) - td) / 86400000 <= filters.maxDaysPassed
      );
    }

    validHighs.sort((a, b) => b.price - a.price);
    const highlight = trade.overrideHighPrice ? null : validHighs[Math.min(sellIndex, validHighs.length - 1)];
    const forced = trade.overrideHighPrice;

    const { dollars, percent } = calculatePL(trade, sellIndex, filters);
    const plClass = dollars >= 0 ? "positive" : "negative";

    return `
<div class="option-card card ${trade.excluded ? "is-excluded" : ""} ${trade.treatAsLoss ? "treat-as-loss" : ""}" data-id="${trade.id}">
  <div class="option-card__btns">
    <button class="loss-btn ${trade.treatAsLoss ? "active" : ""}">−</button>
    <button class="hide-btn ${trade.excluded ? "active" : ""}">👁</button>
    <button class="delete-btn">&times;</button>
  </div>

  <div class="trade-date">${trade.date} ${formatTimeAMPM(trade.time)}</div>

  <ul class="high-prices-ul">
    ${allHighs.sort((a,b)=>b.price-a.price).map(h => {
      const pct = calculatePercentFromPrice(trade, h.price);
      const isForced = forced &&
        forced.date === h.date &&
        forced.time === h.time &&
        forced.price === h.price;

      const isHighlight = !forced && highlight &&
        highlight.date === h.date &&
        highlight.time === h.time &&
        highlight.price === h.price;

      return `
<li class="${isHighlight ? "highest" : ""} ${isForced ? "forced-high" : ""}"
    data-date="${h.date}" data-time="${h.time}" data-price="${h.price}">
  <span>${h.date} ${formatTimeAMPM(h.time)}</span>
  <span>$${h.price.toFixed(2)} <span class="profit ${pct >= 0 ? "positive" : "negative"}">(${pct.toFixed(2)}%)</span></span>
</li>`;
    }).join("")}
  </ul>

  <div class="pl-container">
    <span class="profit ${plClass}">
      ${dollars >= 0 ? "+" : "-"}$${Math.abs(dollars).toFixed(2)} (${percent.toFixed(2)}%)
    </span>
  </div>
</div>`;
  }).join("");

  container.querySelectorAll(".delete-btn").forEach(b =>
    b.onclick = e => onDelete(e.target.closest(".card").dataset.id)
  );
  container.querySelectorAll(".loss-btn").forEach(b =>
    b.onclick = e => onToggleLoss(e.target.closest(".card").dataset.id)
  );
  container.querySelectorAll(".hide-btn").forEach(b =>
    b.onclick = e => onToggleExclude(e.target.closest(".card").dataset.id)
  );
  container.querySelectorAll(".high-prices-ul li").forEach(li =>
    li.onclick = e => onToggleOverride(e.target.closest(".card").dataset.id, li.dataset)
  );
}