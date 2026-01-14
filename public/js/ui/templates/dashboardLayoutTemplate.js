// ui/templates/dashboardLayoutTemplate.js

export function renderDashboardLayoutTemplate({ tickerOptions }) {
    return `
        ${renderFiltersLayout(tickerOptions)}
        ${renderStatsLayout()}
    `;
}

function renderStatsLayout() {
    return `
        <div class="stats-card-bottom">
            <div class="stat-totals"></div>
            <div class="stats"></div>
        </div>
    `;
}

function renderFiltersLayout(tickerOptions) {
    return `
        <div class="stats-card-top">
            <div class="filters">
                <div class="filters__row">
                    <div class="filters__filter">
                        <label>Sort By</label>
                        <select id="sort-order" data-filter="sortOrder">
                            <option value="newest">Newest → Oldest</option>
                            <option value="oldest">Oldest → Newest</option>
                        </select>
                    </div>

                    <div class="filters__filter">
                        <label>Start Date</label>
                        <input type="date" id="start-date" data-filter="startDate">
                    </div>

                    <div class="filters__filter">
                        <label>End Date</label>
                        <input type="date" id="end-date" data-filter="endDate">
                    </div>
                </div>

                <div class="filters__row">
                    <div class="filters__filter">
                        <label>% Loss Modifier</label>
                        <input
                            type="number"
                            id="percent-loss-modifier"
                            step="0.01"
                            data-filter="percentLossModifier"
                        >
                    </div>

                    <div class="filters__filter">
                        <label>Max Gain %</label>
                        <input
                            type="number"
                            id="max-gain-percent-filter"
                            step="0.01"
                            data-filter="maxGainPercent"
                        >
                    </div>

                    <div class="filters__filter">
                        <label>Min Gain %</label>
                        <input
                            type="number"
                            id="min-gain-percent-filter"
                            step="0.01"
                            data-filter="minGainPercent"
                        >
                    </div>

                    <div class="filters__filter">
                        <label>Max Days Passed</label>
                        <select
                            id="max-days-passed-filter"
                            data-filter="selectedMaxDaysPassed"
                        ></select>
                    </div>

                    <div class="filters__filter">
                        <label>Max High Time</label>
                        <div class="filter-input-container">
                            <input
                                class="input--max-high-time"
                                type="time"
                                id="max-high-time"
                                data-filter="maxHighTime"
                            >
                            <button
                                class="button--max-high-time"
                                type="button"
                                id="reset-max-time"
                            >
                                ↺
                            </button>
                        </div>
                    </div>

                    <div class="filters__filter">
                        <label>Sell Price</label>
                        <select
                            id="sell-price-select"
                            data-filter="selectedSellPrice"
                        ></select>
                    </div>

                    <div class="filters__filter">
                        <label>Verified</label>
                        <select id="verified-filter" data-filter="verified">
                            <option value="all">All</option>
                            <option value="verified">Verified</option>
                            <option value="unverified">Unverified</option>
                        </select>
                    </div>
                </div>

                <div class="filters__row">
                    <div class="filters__filter">
                        <label>Trade Type</label>
                        <select
                            id="trade-type-filter"
                            multiple
                            data-filter="tradeType"
                        >
                            <option value="swing">Swing</option>
                            <option value="swing-day">Swing → Day</option>
                            <option value="0dte">0DTE</option>
                        </select>
                    </div>

                    <div class="filters__filter">
                        <label>Day</label>
                        <select id="day-filter" multiple data-filter="day">
                            <option>Monday</option>
                            <option>Tuesday</option>
                            <option>Wednesday</option>
                            <option>Thursday</option>
                            <option>Friday</option>
                        </select>
                    </div>

                    <div class="filters__filter">
                        <label>Ticker</label>
                        <select
                            id="ticker-filter"
                            multiple
                            data-filter="ticker"
                        >
                            ${tickerOptions}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}
