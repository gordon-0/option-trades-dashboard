// ui/templates/tradeCardTemplate.js


import {
  calculatePercentFromPrice,
  formatTimeAMPM
} from "../../logic/helpers.js";

export function renderHighItem({
  trade,
  high,
  highlightHigh,
  view,
  getHighExclusionState
}) {
  const percent = calculatePercentFromPrice(trade.avgEntry, high.price);
  const percentClass = percent >= 0 ? "profit-green" : "loss-red";

  const isOverrideHigh = trade.highOverrideId === high.id;
  const isHighlight =
    !trade.highOverrideId &&
    highlightHigh &&
    high.id === highlightHigh.id;

  const exclusion = getHighExclusionState(trade, high);

  const isExcluded =
    !isHighlight &&
    !isOverrideHigh &&
    (
      exclusion.isAfterMaxTime ||
      exclusion.isAfterDaysPassed ||
      exclusion.isAfterMaxGain ||
      exclusion.isBelowMinGain
    );

  const liClasses = [
    trade.treatAsLoss && "option-high--treat-as-loss",
    isHighlight && "option-high--highest",
    isOverrideHigh && "option-high--override",
    isExcluded && "option-high--is-excluded"
  ].filter(Boolean).join(" ");

  return `
    <li
      class="option-high ${liClasses}"
      data-high-id="${high.id}"
    >
      <span class="option-high__date-time">
        ${high.highDateTime.toISOString().split("T")[0]}
        ${formatTimeAMPM(high.highDateTime)}
      </span>

      <span class="option-high__price">
        $${high.price.toFixed(2)}
        <span class="option-high__gain-percent ${percentClass}">
          (${percent >= 0 ? "+" : "-"}${Math.abs(percent).toFixed(2)}%)
        </span>
      </span>
    </li>
  `;
}


export function renderTradeCardTemplate({
    trade,
    pl,
    highlightHigh,
    overrideHigh,
    view,
    getFilteredHighs,
    calculateHighStats,
    getHighExclusionState
}) {

    const allHighs = [...trade.optionPriceHighs];
    const plClass = pl.dollars >= 0 ? "profit-green" : "loss-red";
    // Render highs list 

    const renderHighs = () =>
    allHighs
        .sort((a, b) => b.price - a.price)
        .map(h =>
            renderHighItem({
                trade,
                high: h,
                highlightHigh,
                view,
                getHighExclusionState
            })
        )
        .join("");
    // Calculate filtered highs 

    const filteredHighs = getFilteredHighs(trade);
    // Render Avg/Median stats only if there are valid highs 

    let highStatsHTML = ''; if (!trade.treatAsLoss && filteredHighs.length) {

        const { avg, avgPercent, median, medianPercent } = calculateHighStats(filteredHighs, trade.avgEntry);
        const avgPercentClass = avgPercent >= 0 ? "profit-green" : "loss-red";
        const medianPercentClass = medianPercent >= 0 ? "profit-green" : "loss-red";
        // Highlight only if no override high exists 
        const highlightOverrideExists = !!trade.highOverrideId;
        const avgHighlightClass =
            !highlightOverrideExists && view.selectedSellPrice === "avg"
                ? "option-high--highest"
                : "";

        const medianHighlightClass =
            !highlightOverrideExists && view.selectedSellPrice === "median"
                ? "option-high--highest"
                : "";

        highStatsHTML = `
                <div class="option-high-stats">
                    <div class="option-high-stats__stat ${avgHighlightClass}">
                        <span class="option-high-stats__stat-title">
                            Avg:
                        </span>
                        <span class="option-high-stats__stat-value">
                            ${avg}
                            <span class="option-high-stats__stat-percent ${avgPercentClass}">
                                (${avgPercent >= 0 ? "+" : "-"}${Math.abs(avgPercent)}%)
                            </span>
                        </span>
                    </div>
                    <div class="option-high-stats__stat ${medianHighlightClass}">
                        <span class="option-high-stats__stat-title">
                            Median:
                        </span>
                        <span class="option-high-stats__stat-value">
                            ${median}
                            <span class="option-high-stats__stat-percent ${medianPercentClass}">
                                (${medianPercent >= 0 ? "+" : "-"}${Math.abs(medianPercent)}%)
                            </span>
                        </span>
                    </div>
                </div>`;
    }

    return `
        <div class="option-card dashboard-card ${trade.excluded ? 'option-card--is-excluded' : ''} ${trade.treatAsLoss ? 'option-card--treat-as-loss' : ''}" data-trade-id="${trade.id}">
            <div class="option-card__btns">
                <button class="option-card-btn option-card-btn--loss ${trade.treatAsLoss ? 'is-active' : ''}">
                    −
                </button>
                <button class="option-card-btn option-card-btn--hide ${trade.excluded ? 'is-active' : ''}">
                    👁
                </button>
                <button class="option-card-btn option-card-btn--delete">
                    &times;
                </button>
            </div>
            <div class="option-card__trade-info">
                <div class="option-trade-date">
                    <span>
                        ${trade.tradeDateTime.toLocaleDateString()} ${formatTimeAMPM(trade.tradeDateTime)}
                    </span>
                </div>
                <div class="option-info">
                    <span class="option-info__ticker">
                        ${trade.ticker}
                    </span>
                    <span class="option-info__strike">
                        ${trade.strikePrice}
                    </span>
                    <span>
                        @
                    </span>
                    <span class="option-info__avg-entry">
                        ${trade.avgEntry.toFixed(2)}
                    </span>
                    <br>
                        <span class="option-info__expiry">
                            Exp: ${trade.expireDateTime.toLocaleDateString()}
                        </span>
                        <div class="option-info__type option-info__type--${trade.optionType}">
                            <span>
                                ${trade.optionType.toUpperCase()}
                            </span>
                        </div>
                </div>
            </div>
            <div class="option-card__image-gallery">
                ${trade.images && trade.images.length
            ? `<div class="image-grid">
                ${trade.images.slice(0, 9).map(url => `
                    <div class="image-grid__item" data-image-url="${url}">
                        <a href="${url}" target="_blank" rel="noopener noreferrer">
                            <img src="${url}" width="64" height="64" alt="Trade Image">
                        </a>
                        <button type="button" class="image-grid__delete-btn">&times;</button>
                    </div>`).join('')}
               </div>`
            : ''
        }
                <div class="option-card__upload-btn-container">
                    <input type="file" accept="image/*" class="option-card__upload-input" style="display:none">
                        <button type="button" class="option-card-btn option-card-btn--upload">Upload Image</button>
                </div>
            </div>

            <div class="option-card__price-highs">
                <hr>
                    <ul class="option-highs-list">
                        ${renderHighs()}
                    </ul>
                    ${highStatsHTML}
            </div>
            <div class="option-high-form">
                <div class="option-high-form__inputs">
                    <input type="date" class="option-high-form__date" value="2025-06-26">
                        <input type="time" class="option-high-form__time">
                            <input type="number" class="option-high-form__price" placeholder="Price" step="0.01">
                                <button type="button" class="option-high-form__add-btn">+</button>
                            </div>
                        </div>
                        <hr>
                            <div class="option-card__pl">
                                <span>P/L:</span>
                                <span class="option-card__total-return ${plClass}">
                                    ${pl.dollars >= 0 ? "+" : "-"}$${Math.abs(pl.dollars).toFixed(2)} (${pl.percent >= 0 ? "+" : "-"}${Math.abs(pl.percent).toFixed(2)}%)
                                </span>
                            </div>
                        </div>`;
}