import {
    getDayName,
    getOrdinal,
    formatTimeAMPM,
    formatMs,
    calculateAverage,
    calculateMedian,
    calculatePercentFromPrice
} from "./logic/helpers.js";

import { testFilterEndpoint } from "./logic/testFilterEndpoint.js";


class TradeDashboard {

    static SORT_ORDER_STORAGE_KEY = "OptionTradeDashboard.sortOrder";

    static FILTER_TRANSFORMS = {
        startDate: v => v ? new Date(v) : null,
        endDate: v => v ? new Date(v) : null,
        maxGainPercent: v => v === "" ? null : parseFloat(v),
        selectedMaxDaysPassed: v => v === "" ? null : parseInt(v, 10),
        selectedSellPrice: v => {
            if (v === "avg" || v === "median") return v;
            return parseInt(v, 10) || 0;
        },
        sortOrder: v => v,
        verified: v => v,
        maxHighTime: v => v || null,
        percentLossModifier: v => v === "" ? 100 : parseFloat(v)
    };


    constructor() {
        this.tradesData = [];
        this.tradesMinMaxDates = null;
        this.optionCardContainer = document.getElementById("option-cards-container");
        this.mainDashboardCard = document.getElementById("main-dashboard-card");

        const storedSortOrder = localStorage.getItem(TradeDashboard.SORT_ORDER_STORAGE_KEY);

        this.isBootstrapping = true;

        this.state = {
            query: {
                startDate: null,
                endDate: null,
                verified: "all",
                selectedTradeTypes: [],
                selectedDays: [],
                selectedTickers: [],
                sortOrder: storedSortOrder || "newest"
            },

            view: {
                selectedSellPrice: 0,
                selectedMaxDaysPassed: null,
                maxHighTime: null,
                maxGainPercent: null,
                percentLossModifier: 100
            }
        };

        // ⬇️ NEW: derived state lives OUTSIDE state machine
        this.derived = {
            visibleTrades: [],
            plByTradeId: new Map(),
            metrics: {},
            summary: {}
        };



        this.init();
    }

async init() {
    try {
        this.renderDashboardLayout();
        this.cacheEls();               // ✅ ADD THIS LINE
        this.initDashboardFilters();
        this.bindTradeCardEvents();
        this.bindTradeChangeEvents();

        await this.loadTrades({ updateFilters: true });

        this.isBootstrapping = false;
        this.render();
    } catch (err) {
        console.error("Error initializing dashboard:", err);
    }
}



    bindTradeChangeEvents() {
        document.addEventListener("trades:changed", async () => {
            try {
                this.reloadTrades();
            } catch (err) {
                console.error("Error handling trades:changed:", err);
            }
        });
    }

    get query() {
        return this.state.query;
    }

    get view() {
        return this.state.view;
    }

    async loadTrades({ updateFilters = true } = {}) {
        try {
            const data = await this.fetchTrades();
            this.tradesData = this.normalizeTrades(data);

            if (updateFilters) {
                this.updateAllDynamicFilters();
            }

            this.recomputeDerivedState();
            this.render();
        } catch (err) {
            console.error("Error loading trades:", err);
            this.tradesData = [];
            this.recomputeDerivedState();
            this.render();
        }
    }


    async reloadTrades() {
        await this.loadTrades({ updateFilters: true });
    }


    async fetchTrades() {
        try {
            const {
                startDate,
                endDate,
                verified,
                selectedTickers,
                selectedTradeTypes,
                selectedDays,
                sortOrder
            } = this.query; // ✅ NEW SOURCE OF TRUTH

            const payload = {
                startDate: startDate?.toISOString() || null,
                endDate: endDate?.toISOString() || null,
                verified,
                tickers: selectedTickers,
                tradeTypes: selectedTradeTypes,
                daysOfWeek: selectedDays,
                sortOrder
            };

            const res = await fetch("/trades/filtered", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();

            console.log(data, 'data');

            this.availableFilters = data.availableFilters || {};

            if (data.tradesMinMaxDates?.min && data.tradesMinMaxDates?.max) {
                this.tradesMinMaxDates = {
                    min: new Date(data.tradesMinMaxDates.min),
                    max: new Date(data.tradesMinMaxDates.max)
                };
            }
            return data.trades || [];
        } catch (err) {
            console.error("Error fetching trades:", err);
            return [];
        }
    }



    normalizeTrades(data) {
        console.log(data, 'available data')
        return data.map(t => ({
            id: t.id,
            trader: t.trader ?? "",
            ticker: t.ticker ?? "",
            avgEntry: t.average_entry ?? 0,
            strikePrice: t.strike_price ?? 0,
            optionType: t.option_type ?? "call",
            treatAsLoss: t.treat_as_loss ?? false,
            excluded: t.excluded ?? false,
            verified: t.verified ?? false,
            highOverrideId: t.high_override_id ?? null,
            tradeDateTime: t.trade_datetime ? new Date(t.trade_datetime) : null,
            expireDateTime: t.expire_datetime ? new Date(t.expire_datetime) : null,
            optionPriceHighs: (t.option_price_highs ?? []).map(h => ({
                id: h.id,
                price: h.price ?? 0,
                highDateTime: h.high_datetime ? new Date(h.high_datetime) : null,
                daysPassed: h.days_passed
            })),
            images: t.images ?? []
        }));
    }


cacheEls() {
    this.el = {
        startDateFilterEl: document.getElementById("start-date"),
        endDateFilterEl: document.getElementById("end-date"),
        sortOrderFilterEl: document.getElementById("sort-order"),
        sellPriceFilterEl: document.getElementById("sell-price-select"),
        verifiedFilterEl: document.getElementById("verified-filter"),
        maxGainPercentFilterEl: document.getElementById("max-gain-percent-filter"),
        maxHighTimeFilterEl: document.getElementById("max-high-time"),
        daysPassedFilterEl: document.getElementById("max-days-passed-filter"),
        tradeTypeFilterEl: document.getElementById("trade-type-filter"),
        dayFilterEl: document.getElementById("day-filter"),
        tickerFilterEl: document.getElementById("ticker-filter"),
        statTotalsEl: this.mainDashboardCard.querySelector(".stat-totals"),
        statsEl: this.mainDashboardCard.querySelector(".stats")
    };
}


setState(partial) {
    const prev = this.state;

    let queryChanged = false;
    let viewChanged = false;

    const query = { ...prev.query };
    const view = { ...prev.view };

    for (const [key, value] of Object.entries(partial)) {
        if (key in query && query[key] !== value) {
            query[key] = value;
            queryChanged = true;
        } else if (key in view && view[key] !== value) {
            view[key] = value;
            viewChanged = true;
        }
    }

    if (!queryChanged && !viewChanged) return;

    this.state = { query, view };
    this.onStateChange(prev, this.state, { queryChanged, viewChanged });
}





    async onStateChange(prev, next, { queryChanged, viewChanged }) {
        if (!queryChanged && !viewChanged) return;

        // Persist sortOrder
        if (prev.query.sortOrder !== next.query.sortOrder) {
            localStorage.setItem(
                TradeDashboard.SORT_ORDER_STORAGE_KEY,
                next.query.sortOrder
            );
        }

if (queryChanged) {
    await this.loadTrades({ updateFilters: true });
    return;
}

// view-only change
this.recomputeDerivedState();

if (!this.isBootstrapping) {
    this.render();
}

    }





    recomputeDerivedState() {
        const visibleTrades = this.tradesData.filter(t => !t.excluded);

        const plByTradeId = new Map(
            visibleTrades.map(t => [t.id, this.calculatePL(t)])
        );

        const metrics = this.computeMetrics(visibleTrades, plByTradeId);
        const summary = this.computeSummary(visibleTrades, plByTradeId, metrics);

        this.derived = {
            visibleTrades,
            plByTradeId,
            metrics,
            summary
        };
    }


    computeMetrics(trades, plByTradeId) {
        return {
            winLossByDay: this.countWinsLossesByDay(trades, plByTradeId),
            tradesByDay: this.countTradesByDay(trades),
            plByDayBought: this.plByDayBought(trades, plByTradeId),
            plByDaySold: this.plByDaySold(trades, plByTradeId)
        };
    }


    computeSummary(trades, plByTradeId, metrics) {
        const totals = this.calculateTradeTotals(trades, plByTradeId);
        const outcomes = this.calculateTradeOutcomes(trades, plByTradeId);
        const composition = this.calculateTradeComposition(trades);
        const duration = this.calculateTradeDurations(trades);

        const { winRatio, weightedWinRatio } =
            this.calculateWinRatios(metrics, plByTradeId);

        return {
            // Money
            totalProfit: totals.profit,
            totalCost: totals.cost,
            totalPercent: totals.percent,

            // Outcomes
            winTradeCount: outcomes.wins,
            lossTradeCount: outcomes.losses,
            winRatio,
            weightedWinRatio,

            // Composition
            calls: composition.calls,
            puts: composition.puts,
            swings: composition.swings,
            swingsDay: composition.swingsDay,
            zeroDTE: composition.zeroDTE,

            // Durations
            ...duration,

            // UI passthroughs
            tradesByDay: metrics.tradesByDay,
            plByDayBought: metrics.plByDayBought,
            plByDaySold: metrics.plByDaySold
        };
    }


render() {
    if (this.isBootstrapping) return;

    this.renderStats();
    this.renderTrades(this.tradesData, this.derived.plByTradeId);
}

getSortedHighs(trade) {
    if (!trade.optionPriceHighs?.length) return [];
    return [...trade.optionPriceHighs].sort((a, b) => b.price - a.price);
}



    calculateTradeTotals(trades, plByTradeId) {
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

    calculateTradeOutcomes(trades, plByTradeId) {
        let wins = 0;
        let losses = 0;

        for (const trade of trades) {
            const { dollars } = plByTradeId.get(trade.id);
            if (!trade.treatAsLoss && dollars > 0) wins++;
            else losses++;
        }

        return { wins, losses };
    }

    calculateTradeComposition(trades) {
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
                if (!trade.treatAsLoss && this.isSwingDayTrade(trade)) {
                    swingsDay++;
                }
            }
        }

        return { calls, puts, swings, swingsDay, zeroDTE };
    }

    calculateTradeDurations(trades) {
        const timeStats = this.calculateOptionHighTimeStats(trades);

        return {
            avgMs: timeStats.high.avg,
            medianMs: timeStats.high.median,
            avgHL: timeStats.highLow.avg,
            medianHL: timeStats.highLow.median
        };
    }





    countWinsLossesByDay(trades, plByTradeId) {
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


    calculateWinRatios(metrics, plByTradeId) {
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


    getFilteredHighs(trade) {
        if (trade.treatAsLoss || !trade.optionPriceHighs?.length) return [];

        const {
            maxGainPercent,
            maxHighTime,
            selectedMaxDaysPassed
        } = this.view; // ✅ updated to use view slice

        let highs = [...trade.optionPriceHighs];
        highs = this.filterHighsByMaxGain(highs, trade.avgEntry, maxGainPercent);
        highs = this.filterHighsByMaxHighTime(highs, maxHighTime);
        highs = this.filterHighsByMaxDaysPassed(highs, selectedMaxDaysPassed);

        return highs;
    }



    filterHighsByMaxGain(highs, avgEntry, maxGainPercent) {
        if (!Number.isFinite(maxGainPercent)) return highs;
        return highs.filter(h => ((h.price - avgEntry) / avgEntry) * 100 <= maxGainPercent);
    }

    filterHighsByMaxHighTime(highs, maxHighTime) {
        if (!maxHighTime) return highs;

        return highs.filter(h => {
            const highTime = h.highDateTime.toTimeString().slice(0, 5);
            return highTime <= maxHighTime;
        });
    }


    filterHighsByMaxDaysPassed(highs, selectedMaxDaysPassed) {
        if (!Number.isFinite(selectedMaxDaysPassed)) return highs; // no filter if not finite

        return highs.filter(h => Number.isFinite(h.daysPassed) && h.daysPassed <= selectedMaxDaysPassed);
    }


    isSwingDayTrade(trade) {
        if (!trade.optionPriceHighs?.length) return false;
        if (!(trade.tradeDateTime instanceof Date)) return false;

        const tradeDay = trade.tradeDateTime.toDateString();

        return trade.optionPriceHighs.every(h =>
            h.highDateTime instanceof Date &&
            !isNaN(h.highDateTime) &&
            h.highDateTime.toDateString() === tradeDay
        );
    }

    sortHighsByDescending(highs) {
        return [...highs].sort((a, b) => b.price - a.price);
    }

    getHighestHighPrice(highs) {
        const { selectedSellPrice } = this.view; // ✅ use view slice
        if (!highs?.length) return null;

        const sortedHighs = [...highs].sort((a, b) => b.price - a.price);
        const prices = sortedHighs.map(h => h.price);


        if (selectedSellPrice === "avg") {
            const avg = calculateAverage(prices);
            return { price: avg };
        }

        if (selectedSellPrice === "median") {
            const mid = Math.floor(prices.length / 2);
            const median = prices.length % 2 === 0
                ? (prices[mid - 1] + prices[mid]) / 2
                : prices[mid];
            return { price: median };
        }

        // numeric index
        const idx = Math.min(selectedSellPrice, prices.length - 1);
        return sortedHighs[idx];
    }





    calculatePL(trade) {
        if (trade.treatAsLoss) return { dollars: -trade.avgEntry * 100, percent: -100 };

        let high;
        if (trade.highOverrideId) {
            high = trade.optionPriceHighs.find(h => h.id === trade.highOverrideId);
        }

        if (!high) {
            high = this.getHighestHighPrice(this.getFilteredHighs(trade));
        }

        if (!high) {
            const lossPercent = -this.view.percentLossModifier; // ✅ use view slice
            const dollars = (lossPercent / 100) * trade.avgEntry * 100;
            return { dollars, percent: lossPercent };
        }

        const dollars = (high.price - trade.avgEntry) * 100;
        const percent = ((high.price - trade.avgEntry) / trade.avgEntry) * 100;

        return { dollars, percent };
    }


    getOptionHighTimeDiffs(trades) {
        return trades.reduce(
            (acc, trade) => {
                const highs = this.getFilteredHighs(trade);
                if (highs.length < 2) return acc;

                // ---- High-to-high ----
                const chronTimes = highs
                    .map(h => h.highDateTime)
                    .sort((a, b) => a - b);

                for (let i = 1; i < chronTimes.length; i++) {
                    acc.high.push(Math.abs(chronTimes[i] - chronTimes[i - 1]));
                }

                // ---- Highest-to-lowest ----
                const [max, min] = [...highs]
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 2)
                    .map(h => h.highDateTime);

                if (max && min) {
                    acc.highLow.push(Math.abs(max - min));
                }

                return acc;
            },
            { high: [], highLow: [] }
        );
    }


    calculateOptionHighTimeStats(trades) {
        const { high, highLow } = this.getOptionHighTimeDiffs(trades);

        return {
            high: {
                avg: calculateAverage(high),
                median: calculateMedian(high)
            },
            highLow: {
                avg: calculateAverage(highLow),
                median: calculateMedian(highLow)
            }
        };
    }




    countTradesByDay(trades) {
        const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
        trades.forEach(t => {
            const day = getDayName(t.tradeDateTime);
            if (days[day] !== undefined) days[day]++;
        });
        return days;
    }

    plByDayBought(trades, plByTradeId) {
        const daysPL = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };

        trades.forEach(t => {
            const day = getDayName(t.tradeDateTime);
            if (daysPL[day] === undefined) return;

            const pl = plByTradeId.get(t.id);
            if (!pl) return;

            daysPL[day] += pl.dollars;
        });

        return daysPL;
    }



    plByDaySold(trades, plByTradeId) {
        const daysPL = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };

        trades.forEach(t => {
            const pl = plByTradeId.get(t.id);
            if (!pl) return;

            const highs = this.getFilteredHighs(t);
            const selectedHigh = this.getHighestHighPrice(highs);

            let day;
            if (selectedHigh?.highDateTime) {
                day = getDayName(selectedHigh.highDateTime);
            } else {
                day = getDayName(t.expireDateTime || t.tradeDateTime);
            }

            if (daysPL[day] !== undefined) {
                daysPL[day] += pl.dollars;
            }
        });

        return daysPL;
    }


    calculateHighStats(highs, avgEntry) {
        if (!highs.length || !avgEntry) {
            return { avg: '—', avgPercent: null, median: '—', medianPercent: null };
        }

        const prices = highs.map(h => h.price);

        const avg = calculateAverage(prices);
        const median = calculateMedian(prices);

        return {
            avg: avg.toFixed(2),
            avgPercent: ((avg - avgEntry) / avgEntry * 100).toFixed(2),
            median: median.toFixed(2),
            medianPercent: ((median - avgEntry) / avgEntry * 100).toFixed(2)
        };
    }


    renderDashboardLayout() {
        this.mainDashboardCard.innerHTML = `
        ${this.renderFiltersLayout()}
        ${this.renderStatsLayout()}
    `;
    }

    renderFiltersLayout() {

        const tickers = [...new Set(this.tradesData.map(t => t.ticker))].sort();
        const tickerOptions = tickers.map(t => `<option value="${t}">${t}</option>`).join("");

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
                    <input type="number" id="percent-loss-modifier" step="0.01" data-filter="percentLossModifier">
                </div>
                <div class="filters__filter">
                    <label>Max Gain %</label>
                    <input type="number" id="max-gain-percent-filter" step="0.01" data-filter="maxGainPercent">
                </div>

                <div class="filters__filter">
                    <label>Max Days Passed</label>
                    <select id="max-days-passed-filter" data-filter="selectedMaxDaysPassed"></select>
                </div>

                <div class="filters__filter">
                    <label>Max High Time</label>
                    <div class="filter-input-container">
                        <input class="input--max-high-time" type="time" id="max-high-time" data-filter="maxHighTime">
                        <button class="button--max-high-time" type="button" id="reset-max-time">↺</button>
                    </div>
                </div>

                <div class="filters__filter">
                    <label>Sell Price</label>
                    <select id="sell-price-select" data-filter="selectedSellPrice"></select>
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
                    <select id="trade-type-filter" multiple data-filter="tradeType">
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
                    <select id="ticker-filter" multiple data-filter="ticker">
                     ${tickerOptions}
                     </select>
                </div>
            </div>

        </div>
    </div>
    `;
    }

    renderStatsLayout() {
        return `
    <div class="stats-card-bottom">
        <div class="stat-totals"></div>
        <div class="stats"></div>
    </div>
    `;
    }

    renderStats() {

        const stats = this.derived.summary;
        if (!stats) return;

        const { statTotalsEl, statsEl } = this.el;

        statTotalsEl.innerHTML = this.renderStatTotalsTemplate({
            totalProfit: stats.totalProfit,
            totalPercent: stats.totalPercent,
            winRatio: stats.winRatio,
            weightedWinRatio: stats.weightedWinRatio,
            calls: stats.calls,
            puts: stats.puts,
            winTradeCount: stats.winTradeCount,
            lossTradeCount: stats.lossTradeCount
        });

        statsEl.innerHTML = this.renderStatsTemplate({
            swings: stats.swings,
            swingsDay: stats.swingsDay,
            zeroDTE: stats.zeroDTE,
            avgMs: stats.avgMs ? formatMs(stats.avgMs) : null,
            avgHL: stats.avgHL ? formatMs(stats.avgHL) : null,
            medianMs: stats.medianMs ? formatMs(stats.medianMs) : null,
            medianHL: stats.medianHL ? formatMs(stats.medianHL) : null,
            tradesByDay: stats.tradesByDay,
            plByDayBought: stats.plByDayBought,
            plByDaySold: stats.plByDaySold
        });
    }


    renderStatTotalsTemplate({
        totalProfit,
        totalPercent,
        winRatio,
        weightedWinRatio,
        calls,
        puts,
        winTradeCount,
        lossTradeCount
    }) {

        const plClass = totalProfit >= 0 ? "profit-green" : "loss-red";
        const winClass = winRatio >= 50 ? "profit-green" : "loss-red";
        const weightedClass = weightedWinRatio >= 50 ? "profit-green" : "loss-red";

        return `
        <div class="stat">
            <span class="stat__title">TOTAL P/L:</span>
            <span class="stat__value return ${plClass}">
                ${totalProfit >= 0 ? "+" : "-"}$${Math.abs(totalProfit).toFixed(2)}
                (${totalPercent >= 0 ? "+" : "-"}${Math.abs(totalPercent).toFixed(2)}%)
            </span>
        </div>

        <div class="stats-row">
                <div class="stat">
                    <span class="stat__title">WIN RATIO: </span>
                    <span class="stat__value ${winClass}">${winRatio.toFixed(2)}%</span>
                </div>
                <div class="stat">
                    <span class="stat__title">WEIGHTED WIN RATIO: </span>
                    <span class="stat__value ${weightedClass}">${weightedWinRatio.toFixed(2)}%</span>
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
        <span class="stat__value">
            <strong>${winTradeCount}</strong>
        </span>
    </div>
    <div class="stat">
        <span class="stat__title">Losses:</span>
        <span class="stat__value">
            <strong>${lossTradeCount}</strong>
        </span>
    </div>
</div>
    `;
    }


    renderPLByDay(plByObj) {
        return Object.entries(plByObj)
            .map(([day, dollars]) => {
                if (dollars === 0) return `${day}: $0.00`;

                const sign = dollars > 0 ? "+" : "-";
                const plClass = dollars > 0 ? "profit-green" : "loss-red";

                return `${day}:
                <span class="return ${plClass}">
                    ${sign}$${Math.abs(dollars).toFixed(2)}
                </span>`;
            })
            .join("  ");
    }

    renderTradesCountByDay(tradesByDay) {
        return Object.entries(tradesByDay)
            .map(([day, count]) => `${day}: ${count}`)
            .join("  ");
    }


    renderTradesWinLossByDay() {
        const winLossByDay = this.derived.metrics.winLossByDay;
        if (!winLossByDay) return "";

        return Object.entries(winLossByDay)
            .map(([day, { wins, losses }]) => `
            ${day}:
            <span>W:</span><span class="profit-green">${wins}</span>
            <span>L:</span><span class="loss-red">${losses}</span>
        `)
            .join(" ");
    }

    renderStatsTemplate({
        swings,
        swingsDay,
        zeroDTE,
        avgMs,
        avgHL,
        medianMs,
        medianHL,
        tradesByDay,
        plByDayBought,
        plByDaySold
    }) {
        return `
        <div class="stats-row">
            <div class="stat">
                <span class="stat__title">Swing Trades:</span>
                <span class="stat__value"><strong>${swings}</strong></span>
            </div>
            <div class="stat">
                <span class="stat__title">Swing Trades Completed as Day Trades:</span>
                <span class="stat__value"><strong>${swingsDay}</strong></span>
            </div>
            <div class="stat">
                <span class="stat__title">0DTE Trades:</span>
                <span class="stat__value"><strong>${zeroDTE}</strong></span>
            </div>
        </div>

        <div class="stat">
            <span class="stat__title">Avg Time Between High Prices:</span>
            <span class="stat__value"><strong>${avgMs ?? "—"}</strong></span>
        </div>

        <div class="stat">
            <span class="stat__title">Avg Time Between Highest & Lowest Price:</span>
            <span class="stat__value"><strong>${avgHL ?? "—"}</strong></span>
        </div>

        <div class="stat">
            <span class="stat__title">Median Time Between High Prices:</span>
            <span class="stat__value"><strong>${medianMs ?? "—"}</strong></span>
        </div>

        <div class="stat">
            <span class="stat__title">Median Time Between Highest & Lowest Price:</span>
            <span class="stat__value"><strong>${medianHL ?? "—"}</strong></span>
        </div>

        <div class="dashboard-days">
            Trades by Day: ${this.renderTradesCountByDay(tradesByDay)}
        </div>

        <div class="dashboard-days">
            Wins/Losses by Day: ${this.renderTradesWinLossByDay(this.tradesData)}
        </div>

        <div class="dashboard-days">
            P/L by Day (Day Bought): ${this.renderPLByDay(plByDayBought)}
        </div>

        <div class="dashboard-days">
            P/L by Day (Day Sold): ${this.renderPLByDay(plByDaySold)}
        </div>
    `;
    }

    renderTrades(trades, plByTradeId) {
        this.optionCardContainer.innerHTML = trades.map(trade => {
            const pl = plByTradeId.get(trade.id) || { dollars: 0, percent: 0 };

            const highlightHigh = this.getHighestHighPrice(
                this.getFilteredHighs(trade)
            );

            return this.renderTradeCardTemplate(trade, pl, highlightHigh, trade.highOverrideId);
        }).join("");
    }

    getHighExclusionState(trade, high) {
        const { maxHighTime, selectedMaxDaysPassed, maxGainPercent } = this.view; // ✅ use view slice

        const percent = calculatePercentFromPrice(trade.avgEntry, high.price);

        const highTime = high.highDateTime.toTimeString().slice(0, 5);
        const daysPassed = high.daysPassed;

        return {
            isAfterMaxGain:
                Number.isFinite(maxGainPercent) && percent > maxGainPercent,

            isAfterMaxTime:
                maxHighTime != null && highTime > maxHighTime,

            isAfterDaysPassed:
                Number.isFinite(selectedMaxDaysPassed) && daysPassed > selectedMaxDaysPassed
        };
    }



    renderHighItem({ trade, high, highlightHigh }) {
        const percent = calculatePercentFromPrice(trade.avgEntry, high.price);
        const percentClass = percent >= 0 ? "profit-green" : "loss-red";

        const highDateStr = high.highDateTime
            ? high.highDateTime.toISOString().split("T")[0]
            : "—";

        // Determine if this high is the forced/override high
        const isOverrideHigh = trade.highOverrideId === high.id;

        // Determine if this high is the normal highlight (highest) only if no override exists
        const isHighlight = !trade.highOverrideId &&
            highlightHigh &&
            high.id === highlightHigh.id;

        // Compute exclusion state once
        const exclusion = this.getHighExclusionState(trade, high);
        const isExcluded =
            !isHighlight &&
            !isOverrideHigh &&
            (exclusion.isAfterMaxTime || exclusion.isAfterDaysPassed || exclusion.isAfterMaxGain);

        const isTreatAsLoss = trade.treatAsLoss;

        const liClasses = [
            isTreatAsLoss && "option-high--treat-as-loss",
            isHighlight && "option-high--highest",
            isOverrideHigh && "option-high--override",
            isExcluded && "option-high--is-excluded"
        ].filter(Boolean).join(" ");

        return `
        <li class="option-high ${liClasses}"
            data-high-datetime="${high.highDateTime.toISOString()}"
            data-price="${high.price}"
            data-high-id="${high.id}">
            <span class="option-high__date-time">${highDateStr} ${formatTimeAMPM(high.highDateTime)}</span>
            <span class="option-high__price">
                $${high.price.toFixed(2)}
                <span class="option-high__gain-percent ${percentClass}">
                    (${percent >= 0 ? "+" : "-"}${Math.abs(percent).toFixed(2)}%)
                </span>
            </span>
        </li>
    `;
    }


    renderTradeCardTemplate(trade, pl, highlightHigh, overrideHigh) {
        const allHighs = [...trade.optionPriceHighs];
        const plClass = pl.dollars >= 0 ? "profit-green" : "loss-red";

        // Render highs list
        const renderHighs = () =>
            allHighs
                .sort((a, b) => b.price - a.price)
                .map(h => this.renderHighItem({
                    trade,
                    high: h,
                    highlightHigh,
                    overrideHigh
                }))
                .join("");

        // Calculate filtered highs
        const filteredHighs = this.getFilteredHighs(trade);

        // Render Avg/Median stats only if there are valid highs
        let highStatsHTML = '';
        if (!trade.treatAsLoss && filteredHighs.length) {
            const { avg, avgPercent, median, medianPercent } = this.calculateHighStats(filteredHighs, trade.avgEntry);

            const avgPercentClass = avgPercent >= 0 ? "profit-green" : "loss-red";
            const medianPercentClass = medianPercent >= 0 ? "profit-green" : "loss-red";

            // Highlight only if no override high exists
            const highlightOverrideExists = !!trade.highOverrideId;

            const avgHighlightClass = !highlightOverrideExists && this.view.selectedSellPrice === "avg";

            const medianHighlightClass = !highlightOverrideExists && this.view.selectedSellPrice === "median" ? "option-high--highest" : "";

            highStatsHTML = `
    <div class="option-high-stats">
        <div class="option-high-stats__stat ${avgHighlightClass}">
            <span class="option-high-stats__stat-title">Avg:</span>
            <span class="option-high-stats__stat-value">
                ${avg}
                <span class="option-high-stats__stat-percent ${avgPercentClass}">
                    (${avgPercent >= 0 ? "+" : "-"}${Math.abs(avgPercent)}%)
                </span>
            </span>
        </div>
        <div class="option-high-stats__stat ${medianHighlightClass}">
            <span class="option-high-stats__stat-title">Median:</span>
            <span class="option-high-stats__stat-value">
                ${median}
                <span class="option-high-stats__stat-percent ${medianPercentClass}">
                    (${medianPercent >= 0 ? "+" : "-"}${Math.abs(medianPercent)}%)
                </span>
            </span>
        </div>
    </div>
    `;
        }


        return `
<div class="option-card dashboard-card ${trade.excluded ? 'option-card--is-excluded' : ''} ${trade.treatAsLoss ? 'option-card--treat-as-loss' : ''}" data-trade-id="${trade.id}">
    <div class="option-card__btns">
        <button class="option-card-btn option-card-btn--loss ${trade.treatAsLoss ? 'is-active' : ''}">−</button>
        <button class="option-card-btn option-card-btn--hide ${trade.excluded ? 'is-active' : ''}">👁</button>
        <button class="option-card-btn option-card-btn--delete">&times;</button>
    </div>

    <div class="option-card__trade-info">
        <div class="option-trade-date">
            <span>${trade.tradeDateTime.toLocaleDateString()} ${formatTimeAMPM(trade.tradeDateTime)}</span>
        </div>
        <div class="option-info">
            <span class="option-info__ticker">${trade.ticker}</span>
            <span class="option-info__strike">${trade.strikePrice}</span>
            <span> @ </span>
            <span class="option-info__avg-entry">${trade.avgEntry.toFixed(2)}</span><br>
            <span class="option-info__expiry">Exp: ${trade.expireDateTime.toLocaleDateString()}</span>
            <div class="option-info__type option-info__type--${trade.optionType}">
                <span>${trade.optionType.toUpperCase()}</span>
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
        <ul class="option-highs-list">${renderHighs()}</ul>

        ${highStatsHTML}
    </div>

    <div class="option-high-form">
        <div class="option-high-form__inputs">
           <input type="date" class="option-high-form__date" value="2025-07-07">
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
</div>
`;
    }

    /* <input type="date" class="option-high-form__date" value="${getLocalDateString()}"></input> */

    initDashboardFilters() {

        this.initSortOrder();
        this.bindFilterEvents();
        this.initMultiChoiceFilters();
        this.updateDateFilter();
        this.updateSellPriceFilter();
        this.updateDaysPassedFilter();
    }

    initSortOrder() {
        const { sortOrderFilterEl } = this.el;
        if (sortOrderFilterEl) {
            sortOrderFilterEl.value = this.query.sortOrder;
        }
    }

    bindFilterEvents() {
        const filtersRoot = this.mainDashboardCard.querySelector(".filters");
        if (!filtersRoot) return;

        filtersRoot.addEventListener("change", e => {
            const el = e.target;
            const key = el.dataset.filter;
            if (!key) return;

            const transform = TradeDashboard.FILTER_TRANSFORMS[key] || (v => v);

            // Update state, which will trigger fetch & render
            this.setState({ [key]: transform(el.value) });
        });

        // Reset max-high-time button
        filtersRoot.addEventListener("click", e => {
            if (!e.target.closest("#reset-max-time")) return;
            const { maxHighTimeFilterEl } = this.el;
            if (maxHighTimeFilterEl) maxHighTimeFilterEl.value = "";
            this.setState({ maxHighTime: null });
        });
    }

    initMultiChoiceFilters() {
        // Day Filter
        this.dayFilter = new Choices("#day-filter", { removeItemButton: true, shouldSort: false, itemSelectText: "" });
        this.dayFilter.passedElement.element.addEventListener("change", () => {
            this.setState({ selectedDays: this.dayFilter.getValue(true) });
        });

        // Ticker Filter
        this.tickerFilter = new Choices("#ticker-filter", { removeItemButton: true, shouldSort: true, itemSelectText: "" });
        this.tickerFilter.passedElement.element.addEventListener("change", () => {
            this.setState({ selectedTickers: this.tickerFilter.getValue(true) });
        });

        // Trade Type Filter
        this.tradeTypeFilter = new Choices("#trade-type-filter", { removeItemButton: true, shouldSort: false, itemSelectText: "" });
        this.tradeTypeFilter.passedElement.element.addEventListener("change", () => {
            this.setState({ selectedTradeTypes: this.tradeTypeFilter.getValue(true) });
        });
    }


    updateChoices(filter, {
        values,
        selected = [],
        labelMap = null,
        sort = true
    }) {
        if (!filter) return;

        let uniqueValues = [...new Set(values)];

        if (sort) {
            uniqueValues.sort();
        }

        const choices = uniqueValues.map(v => ({
            value: v,
            label: labelMap?.[v] ?? v,
            selected: selected.includes(v)
        }));

        filter.clearChoices();
        filter.clearStore();
        filter.removeActiveItems();
        filter.setChoices(choices);
    }


    updateDayFilter() {
        const daysOfWeek = this.availableFilters?.daysOfWeek || [];
        this.updateChoices(this.dayFilter, {
            values: daysOfWeek,
            selected: this.query.selectedDays,
            sort: false
        });
    }



    updateTickerFilter() {
        const tickers = this.availableFilters?.tickers || [];
        this.updateChoices(this.tickerFilter, {
            values: tickers,
            selected: this.query.selectedTickers
        });
    }


    updateTradeTypeFilter() {
        const types = this.availableFilters?.tradeTypes || [];
        this.updateChoices(this.tradeTypeFilter, {
            values: types,
            selected: this.query.selectedTradeTypes,
            labelMap: {
                swing: "Swing",
                "swing-day": "Swing → Day",
                "0dte": "0DTE"
            }
        });
    }


    updateDateFilter() {
        if (!this.tradesMinMaxDates) return;

        const { min, max } = this.tradesMinMaxDates;

        let nextStart = this.query.startDate;
        let nextEnd = this.query.endDate;

        // Initialize once OR expand outward only
        if (!nextStart || min < nextStart) {
            nextStart = min;
        }

        if (!nextEnd || max > nextEnd) {
            nextEnd = max;
        }

        const changed =
            !this.query.startDate ||
            !this.query.endDate ||
            nextStart.getTime() !== this.query.startDate.getTime() ||
            nextEnd.getTime() !== this.query.endDate.getTime();

        if (!changed) return;

        const { startDateFilterEl, endDateFilterEl } = this.el;

        if (startDateFilterEl) startDateFilterEl.valueAsDate = nextStart;
        if (endDateFilterEl) endDateFilterEl.valueAsDate = nextEnd;

        this.setState({
            startDate: nextStart,
            endDate: nextEnd
        });
    }



    updateSellPriceFilter() {
        const { sellPriceFilterEl } = this.el;
        if (!this.tradesData.length || !sellPriceFilterEl) return;

        let maxHighs = 0;
        this.tradesData.forEach(trade => {
            if (trade.excluded || trade.treatAsLoss || trade.highOverrideId) return;
            const highs = this.getFilteredHighs(trade);
            if (highs.length > maxHighs) maxHighs = highs.length;
        });

        if (maxHighs === 0) {
            sellPriceFilterEl.innerHTML = "";
            if (this.view.selectedSellPrice !== 0) this.setState({ selectedSellPrice: 0 });
            return;
        }

        const options = [];

        // Highest first
        options.push(`<option value="0">Highest</option>`);

        // Numeric highs (2nd → last)
        for (let i = 1; i < maxHighs; i++) {
            const idx = i + 1;
            const label = idx === maxHighs ? "Lowest" : getOrdinal(idx);
            options.push(`<option value="${i}">${label}</option>`);
        }

        // Average / Median at the bottom
        options.push(`<option value="avg">Average</option>`);
        options.push(`<option value="median">Median</option>`);

        sellPriceFilterEl.innerHTML = options.join("");

        // Clamp selection
        const sel = this.state.view.selectedSellPrice;
        if (sel !== "avg" && sel !== "median" && sel >= maxHighs) {
            this.setState({ selectedSellPrice: 0 });
            sellPriceFilterEl.value = "0";
        } else {
            sellPriceFilterEl.value = String(sel);
        }
    }

    updateDaysPassedFilter() {
        const { daysPassedFilterEl } = this.el;
        if (!daysPassedFilterEl) return;

        const daysPassedArray = this.availableFilters?.daysPassed || [0];

        // Build options with formatted labels
        const options = daysPassedArray.map(value => {
            let label;
            if (value === 0) label = "Same Day";
            else if (value === 1) label = "1 Day";
            else label = `${value} Days`;
            return `<option value="${value}">${label}</option>`;
        });

        daysPassedFilterEl.innerHTML = options.join("");

        // Default selected: highest value
        const defaultValue = Math.max(...daysPassedArray);
        daysPassedFilterEl.value = defaultValue;
        this.setState({ selectedMaxDaysPassed: parseInt(daysPassedFilterEl.value, 10) });
    }




    updateAllDynamicFilters() {

        this.updateSellPriceFilter();
        this.updateDaysPassedFilter();

        this.updateDayFilter();
        this.updateTickerFilter();
        this.updateTradeTypeFilter();
    }



    handleDeleteTrade(tradeId) {
        if (!tradeId) return;

        if (!confirm("Delete this trade?")) return;

        fetch(`/trades/${tradeId}`, { method: "DELETE" })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                this.tradesData = this.tradesData.filter(t => t.id !== tradeId);

                document.dispatchEvent(new CustomEvent("trades:changed", {
                    detail: { type: "delete" }
                }));


                this.recomputeDerivedState();
                this.updateAllDynamicFilters();
                this.render();
            })
            .catch(err => console.error("Error deleting trade:", err));
    }


    handleToggleTreatAsLoss(trade) {
        trade.treatAsLoss = !trade.treatAsLoss;

        fetch(`/update_trade/${trade.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ treat_as_loss: trade.treatAsLoss })
        });

        this.recomputeDerivedState();
        this.updateAllDynamicFilters();
        this.render();
    }

    handleToggleExcluded(trade) {
        trade.excluded = !trade.excluded;

        fetch(`/update_trade/${trade.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ excluded: trade.excluded })
        });

        this.recomputeDerivedState();
        this.updateAllDynamicFilters();
        this.render();
    }

    handleAddHigh(trade, cardEl) {
        const dateInput = cardEl.querySelector(".option-high-form__date");
        const timeInput = cardEl.querySelector(".option-high-form__time");
        const priceInput = cardEl.querySelector(".option-high-form__price");

        if (!dateInput || !timeInput || !priceInput) return;

        const date = dateInput.value;
        const time = timeInput.value;
        const price = parseFloat(priceInput.value);

        if (!date || !time || Number.isNaN(price)) return;

        // Combine date + time into a single ISO datetime
        const highDateTime = new Date(`${date}T${time}`);

        if (Number.isNaN(highDateTime.getTime())) return;

        fetch(`/trades/${trade.id}/high`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                high_datetime: highDateTime.toISOString(),
                price
            })
        })
            .then(res => res.json())
            .then(serverHigh => {
                const normalizedHigh = {
                    id: serverHigh.id,
                    price: serverHigh.price,
                    highDateTime: new Date(serverHigh.high_datetime),
                    daysPassed: serverHigh.days_passed
                };

                trade.optionPriceHighs.push(normalizedHigh);

                this.recomputeDerivedState();
                this.updateAllDynamicFilters();
                this.render();
            });

    }


    handleOverrideHigh(trade, liEl) {
        const highId = liEl.dataset.highId;
        if (!highId) return;

        trade.highOverrideId = trade.highOverrideId === highId ? null : highId;

        fetch(`/update_trade/${trade.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ high_override_id: trade.highOverrideId })
        });

        this.recomputeDerivedState();
        this.render();

    }


    async handleImageFileSelected(fileInput, trade) {
        if (!fileInput.files || !fileInput.files.length) return;

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch(`/trades/${trade.id}/image`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (!trade.images) trade.images = [];
            trade.images.push(data.url);

            this.recomputeDerivedState();
            this.updateAllDynamicFilters();
            this.render();
        } catch (err) {
            console.error("Error uploading image:", err);
            alert("Failed to upload image");
        } finally {
            // Important: reset so the same file can be uploaded again
            fileInput.value = "";
        }
    }

    handleImageUploadClick(card, trade) {
        const fileInput = card.querySelector(".option-card__upload-input");
        if (!fileInput) return;

        // Ensure only one change handler exists
        fileInput.onchange = () => this.handleImageFileSelected(fileInput, trade);

        fileInput.click();
    }

    async handleDeleteTradeImage(trade, imageUrl, imageItem) {
        try {
            const res = await fetch(`/trades/${trade.id}/image`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl: imageUrl })
            });

            if (!res.ok) throw new Error(`Failed to delete image: ${res.status}`);

            // Remove image from DOM
            imageItem.remove();

            // Remove image from in-memory trade data
            trade.images = trade.images.filter(url => url !== imageUrl);

        } catch (err) {
            console.error("Error deleting image:", err);
            alert("Failed to delete image. Please try again.");
        }
    }

    bindTradeCardEvents() {
        this.optionCardContainer.addEventListener("click", e => {

            const card = e.target.closest(".option-card");
            if (!card) return;

            const tradeId = card.dataset.tradeId;
            const trade = this.tradesData.find(t => t.id === tradeId);

            if (!trade) return;

            if (e.target.closest(".option-card-btn--delete")) {
                return this.handleDeleteTrade(tradeId);
            }

            if (e.target.closest(".option-card-btn--loss")) {
                return this.handleToggleTreatAsLoss(trade);
            }

            if (e.target.closest(".option-card-btn--hide")) {
                console.log("Toggling excluded for trade:", trade.id, "current state:", trade.excluded);
                const prevHighs = trade.optionPriceHighs?.map(h => ({ ...h })) || [];
                console.log("Highs before toggle:", prevHighs);
                return this.handleToggleExcluded(trade);
            }


            if (e.target.closest(".option-high-form__add-btn")) {
                return this.handleAddHigh(trade, card);
            }

            const highLi = e.target.closest(".option-high");
            if (highLi) {
                if (trade.treatAsLoss) return;
                return this.handleOverrideHigh(trade, highLi);
            }

            if (e.target.closest(".option-card-btn--upload")) {
                return this.handleImageUploadClick(card, trade);
            }

            if (e.target.closest(".image-grid__delete-btn")) {
                const imageItem = e.target.closest(".image-grid__item");
                if (!imageItem) return;

                const imageUrl = imageItem.dataset.imageUrl;
                if (!imageUrl) return;

                const confirmDelete = window.confirm("Are you sure you want to delete this image?");
                if (!confirmDelete) return;

                return this.handleDeleteTradeImage(trade, imageUrl, imageItem);
            }



        });
    }


}

window.addEventListener("DOMContentLoaded", () => {
    window.tradeDashboard = new TradeDashboard();
});
