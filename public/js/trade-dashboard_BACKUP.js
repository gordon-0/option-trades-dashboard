import {
    getDayName,
    getOrdinal,
    formatTimeAMPM,
    formatMs,
    calculateAverage,
    calculateMedian,
    calculatePercentFromPrice
} from "./js/logic/helpers.js";

class TradeDashboard {

    static FILTER_TRANSFORMS = {
        startDate: v => v ? new Date(v) : null,
        endDate: v => v ? new Date(v) : null,
        maxGainPercent: v => v === "" ? null : parseFloat(v),
        maxDaysPassed: v => v === "" ? null : parseInt(v, 10),
        selectedSellPrice: v => {
            if (v === "avg" || v === "median") return v;
            return parseInt(v, 10) || 0;
        },

        sortOrder: v => v,
        verified: v => v,
        maxHighTime: v => v || null
    };

    constructor() {
        this.tradesData = [];
        this.optionCardContainer = document.getElementById("option-cards-container");
        this.mainDashboardCard = document.getElementById("main-dashboard-card");

        this.state = {
            startDate: null,
            endDate: null,
            verified: "all",
            selectedTradeTypes: [],
            selectedSellPrice: 0,
            maxHighTime: null,
            maxDaysPassed: null,
            maxGainPercent: null,
            selectedDays: [],
            selectedTickers: [],
            sortOrder: "newest"
        };

        this.init();
    }

    init() {
        this.fetchTrades()
            .then(data => {
                this.tradesData = this.normalizeTrades(data);
                this.renderDashboardLayout();
                this.initDashboardFilters();
                this.bindTradeCardEvents();
                this.recomputeDerivedState();
                this.render();
            })
            .catch(err => console.error("Error fetching trades:", err));
    }

    async refresh() {
        try {
            const data = await this.fetchTrades();
            this.tradesData = this.normalizeTrades(data);
            this.recomputeDerivedState();
            this.updateAllDynamicFilters();
            this.render();
        } catch (err) {
            console.error("Error refreshing dashboard:", err);
        }
    }

    async fetchTrades() {
        const res = await fetch("/trades");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    }
    normalizeTrades(data) {
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
                highDateTime: h.high_datetime ? new Date(h.high_datetime) : null
            })),
            images: t.images ?? []
        }));
    }




    get el() {
        return {
            startDateFilterEl: document.getElementById("start-date"),
            endDateFilterEl: document.getElementById("end-date"),
            sortOrderFilterEl: document.getElementById("sort-order"),
            sellPriceFilterEl: document.getElementById("sell-price-select"),
            verifiedFilterEl: document.getElementById("verified-filter"),
            maxGainPercentFilterEl: document.getElementById("max-gain-percent-filter"),
            maxHighTimeFilterEl: document.getElementById("max-high-time"),
            daysPassedFilterEl: document.getElementById("days-passed-filter"),
            tradeTypeFilterEl: document.getElementById("trade-type-filter"),
            dayFilterFilterEl: document.getElementById("day-filter"),
            tickerFilterFilterEl: document.getElementById("ticker-filter"),
            statTotalsEl: this.mainDashboardCard.querySelector(".stat-totals"),
            statsEl: this.mainDashboardCard.querySelector(".stats")
        };
    }

    setState(partial) {
        const prevState = { ...this.state };

        this.state = { ...this.state, ...partial };

        this.onStateChange(prevState, this.state);
    }

    onStateChange(prev, next) {
        const filterChanged = JSON.stringify(prev) !== JSON.stringify(next);

        if (filterChanged) {
            this.recomputeDerivedState();
            this.updateAllDynamicFilters();
            this.render();
        }
    }

    recomputeDerivedState() {
        this._filteredTrades = this.getFilteredTrades(this.tradesData);
        this._visibleTrades = this._filteredTrades.filter(t => !t.excluded);

        this._plByTradeId = new Map(
            this._visibleTrades.map(t => [t.id, this.calculatePL(t)])
        );

        this._stats = this.aggregateTradeStats(
            this._visibleTrades,
            this._plByTradeId
        );
    }

    render() {
        this.renderStats(this._visibleTrades, this._plByTradeId);
        this.renderTrades(this._filteredTrades, this._plByTradeId);
    }

    aggregateTradeStats(filteredTrades, plByTradeId) {

        const stats = {
            totalProfit: 0,
            totalCost: 0,
            totalPercent: 0,

            calls: 0,
            puts: 0,

            swings: 0,
            swingsDay: 0,
            zeroDTE: 0,

            winTradeCount: 0,
            lossTradeCount: 0
        };

        /* ===== CORE COUNTS & TOTALS ===== */
        filteredTrades.forEach(t => {
            const { dollars } = plByTradeId.get(t.id);

            // P/L totals
            stats.totalProfit += dollars;
            stats.totalCost += t.avgEntry * 100;

            // Win / Loss counts
            if (!t.treatAsLoss && dollars > 0) {
                stats.winTradeCount++;
            } else {
                stats.lossTradeCount++;
            }

            // Option type
            if (t.optionType.toLowerCase() === "call") stats.calls++;
            if (t.optionType.toLowerCase() === "put") stats.puts++;

            // Swing logic
            if (t.tradeDateTime.toDateString() !== t.expireDateTime.toDateString()) {
                stats.swings++;

                if (!t.treatAsLoss && t.optionPriceHighs?.length) {

                    const highest = this.getHighestHighPrice(t.optionPriceHighs);

                    if (
                        highest.highDateTime &&
                        highest.highDateTime.toDateString() ===
                        t.tradeDateTime.toDateString()
                    ) {
                        stats.swingsDay++;
                    }
                }
            }

            // 0DTE
            if (
                t.tradeDateTime.toDateString() ===
                t.expireDateTime.toDateString()
            ) {
                stats.zeroDTE++;
            }
        });

        /* ===== DERIVED TOTALS ===== */
        stats.totalPercent = stats.totalCost
            ? (stats.totalProfit / stats.totalCost) * 100
            : 0;

        const { winRatio, weightedWinRatio } =
            this.calculateWinRatios(filteredTrades, plByTradeId);

        stats.winRatio = winRatio;
        stats.weightedWinRatio = weightedWinRatio;

        /* ===== TIME STATS ===== */
        stats.avgMs = this.calculateAvgTimeBetweenHighs(filteredTrades);
        stats.avgHL = this.calculateAvgTimeBetweenHighLow(filteredTrades);
        stats.medianMs = this.calculateMedianTimeBetweenHighs(filteredTrades);
        stats.medianHL = this.calculateMedianTimeBetweenHighLow(filteredTrades);

        /* ===== DAY BREAKDOWNS ===== */
        stats.tradesByDay = this.countTradesByDay(filteredTrades);
        stats.plByDayBought = this.plByDayBought(
            filteredTrades,
            this.state.selectedSellPrice
        );
        stats.plByDaySold = this.plByDaySold(
            filteredTrades,
            this.state.selectedSellPrice
        );

        return stats;
    }


    calculateWinRatios(filteredTrades, plByTradeId) {
        const validTrades = filteredTrades.filter(t => !t.excluded);
        const winCount = validTrades.filter(t => !t.treatAsLoss && plByTradeId.get(t.id).dollars > 0).length;
        const winRatio = validTrades.length ? (winCount / validTrades.length) * 100 : 0;

        const totalAbsPL = validTrades.reduce((sum, t) => sum + Math.abs(plByTradeId.get(t.id).dollars), 0);
        const weightedWins = validTrades.reduce((sum, t) => {
            const pl = plByTradeId.get(t.id).dollars;
            return sum + (pl > 0 ? pl : 0);
        }, 0);
        const weightedWinRatio = totalAbsPL ? (weightedWins / totalAbsPL) * 100 : 0;

        return { winRatio, weightedWinRatio };
    }

    getFilteredTrades(trades) {
        return trades
            .filter(t => this.filterByDate(t, this.state.startDate, this.state.endDate))
            .filter(t => this.filterByDay(t, this.state.selectedDays))
            .filter(t => this.filterByTicker(t, this.state.selectedTickers))
            .filter(t => this.filterByVerified(t, this.state.verified))
            .filter(t => this.filterByTradeType(t, this.state.selectedTradeTypes))
            .sort((a, b) =>
                this.state.sortOrder === "oldest"
                    ? a.tradeDateTime - b.tradeDateTime
                    : b.tradeDateTime - a.tradeDateTime
            );

    }

    filterByDate(trade, startDate, endDate) {
        if (!trade.tradeDateTime) return false;

        const tradeDay = trade.tradeDateTime; // already a Date object
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








    filterByTradeType(trade, selectedTradeTypes = []) {
        if (!selectedTradeTypes.length) return true;

        return selectedTradeTypes.some(type => {
            if (type === "swing") return trade.tradeDateTime.getTime() !== trade.expireDateTime.getTime();
            if (type === "swing-day") {
                if (trade.tradeDateTime.toDateString() === trade.expireDateTime.toDateString()) return false;
                if (!trade.optionPriceHighs?.length) return false;

                const highest = this.getHighestHighPrice(trade.optionPriceHighs);

                return (
                    highest.highDateTime.toDateString() ===
                    trade.tradeDateTime.toDateString()
                );

            }
            if (type === "0dte") return trade.tradeDateTime.toDateString() === trade.expireDateTime.toDateString();
            return false;
        });
    }


    filterByDay(trade, selectedDays) {
        if (!selectedDays.length) return true;
        const dayName = getDayName(trade.tradeDateTime);
        return selectedDays.includes(dayName);
    }

    filterByTicker(trade, selectedTickers) {
        if (!selectedTickers.length) return true;
        return selectedTickers.includes(trade.ticker);
    }

    filterByVerified(trade, verified) {
        if (verified === "all") return true;
        if (verified === "verified") return trade.verified;
        if (verified === "unverified") return !trade.verified;
        return true;
    }

    getFilteredHighs(trade) {
        if (trade.treatAsLoss || !trade.optionPriceHighs?.length) return [];

        const {
            maxGainPercent,
            maxHighTime,
            maxDaysPassed
        } = this.state;

        let highs = [...trade.optionPriceHighs];
        highs = this.filterHighsByMaxGain(highs, trade.avgEntry, maxGainPercent);
        highs = this.filterHighsByMaxHighTime(highs, maxHighTime);
        highs = this.filterHighsByMaxDaysPassed(
            highs,
            trade.tradeDateTime,
            maxDaysPassed
        );

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


    filterHighsByMaxDaysPassed(highs, tradeDate, maxDaysPassed) {
        if (!Number.isFinite(maxDaysPassed)) return highs; // no filter if not finite

        return highs.filter(h => {
            if (!(h.highDateTime instanceof Date)) return false;

            const daysDiff = this.getCalendarDayDiff(tradeDate, h.highDateTime);

            return daysDiff <= maxDaysPassed;
        });
    }


    sortHighsByDescending(highs) {
        return [...highs].sort((a, b) => b.price - a.price);
    }

    getHighestHighPrice(highs) {
        const { selectedSellPrice } = this.state;
        if (!highs?.length) return null;

        const prices = highs.map(h => h.price).sort((a, b) => b - a);

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
        return highs.find(h => h.price === prices[idx]);
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

        if (!high) return { dollars: -trade.avgEntry * 100, percent: -100 };

        const dollars = (high.price - trade.avgEntry) * 100;
        const percent = ((high.price - trade.avgEntry) / trade.avgEntry) * 100;

        return { dollars, percent };
    }

    getHighTimeDiffs(trades, { useHighLow = false } = {}) {
        return trades.reduce((diffs, trade) => {
            const highs = this.getFilteredHighs(trade);
            if (highs.length < 2) return diffs;

            let times = useHighLow
                ? highs
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 2)
                    .map(h => h.highDateTime)
                : highs
                    .map(h => h.highDateTime)
                    .sort((a, b) => a - b);


            for (let i = 1; i < times.length; i++) diffs.push(Math.abs(times[i] - times[i - 1]));
            return diffs;
        }, []);
    }

    calculateAvgTimeBetweenHighs(trades) {
        const diffs = this.getHighTimeDiffs(trades);
        return calculateAverage(diffs);
    }

    calculateAvgTimeBetweenHighLow(trades) {
        const diffs = this.getHighTimeDiffs(trades, { useHighLow: true });
        return calculateAverage(diffs);
    }

    calculateMedianTimeBetweenHighLow(trades) {
        return calculateMedian(this.getHighTimeDiffs(trades, { useHighLow: true }));
    }

    calculateMedianTimeBetweenHighs(trades) {
        return calculateMedian(this.getHighTimeDiffs(trades));
    }


    countTradesByDay(trades) {
        const days = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
        trades.forEach(t => {
            const day = getDayName(t.tradeDateTime);
            if (days[day] !== undefined) days[day]++;
        });
        return days;
    }

    plByDayBought(trades) {
        const daysPL = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };

        trades.forEach(t => {
            const day = getDayName(t.tradeDateTime);
            if (daysPL[day] === undefined) return;

            const { dollars } = this._plByTradeId.get(t.id);

            daysPL[day] += dollars;
        });

        return daysPL;
    }


    plByDaySold(trades) {
        const daysPL = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };

        trades.forEach(t => {
            const { dollars } = this._plByTradeId.get(t.id);

            const highs = this.getFilteredHighs(t);
            const selectedHigh = this.getHighestHighPrice(highs);

            // Safe way: use highDateTime if it exists, otherwise fallback to expireDateTime or tradeDateTime
            let day;
            if (selectedHigh?.highDateTime) {
                day = getDayName(selectedHigh.highDateTime);
            } else {
                day = getDayName(t.expireDateTime || t.tradeDateTime);
            }

            if (daysPL[day] !== undefined) {
                daysPL[day] += dollars;
            }
        });

        return daysPL;
    }


    /**
 * Calculates average, median, and their % returns relative to avgEntry
 * @param {Array} highs - array of { price: number } objects
 * @param {number} avgEntry - trade average entry price
 * @returns {Object} - { avg, avgPercent, median, medianPercent }
 */
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
                    <label>Max Gain %</label>
                    <input type="number" id="max-gain-percent-filter" step="0.01" data-filter="maxGainPercent">
                </div>

                <div class="filters__filter">
                    <label>Days Passed</label>
                    <select id="days-passed-filter" data-filter="maxDaysPassed"></select>
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

    renderStats(filteredTrades, plByTradeId) {

        const stats = this.aggregateTradeStats(filteredTrades, plByTradeId);

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
        const { maxHighTime, maxDaysPassed, maxGainPercent } = this.state;

        const percent = calculatePercentFromPrice(trade.avgEntry, high.price);

        const highTime = high.highDateTime.toTimeString().slice(0, 5);

        const daysPassed = this.getCalendarDayDiff(
            trade.tradeDateTime,
            high.highDateTime
        );


        return {
            isAfterMaxGain:
                Number.isFinite(maxGainPercent) && percent > maxGainPercent,

            isAfterMaxTime:
                maxHighTime != null && highTime > maxHighTime,

            isAfterDaysPassed:
                Number.isFinite(maxDaysPassed) && daysPassed > maxDaysPassed
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

            const avgHighlightClass = !highlightOverrideExists && this.state.selectedSellPrice === "avg" ? "option-high--highest" : "";
            const medianHighlightClass = !highlightOverrideExists && this.state.selectedSellPrice === "median" ? "option-high--highest" : "";

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
           <input type="date" class="option-high-form__date" value="2025-08-21">
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

        this.bindFilterEvents();
        this.initMultiChoiceFilters();
        this.updateDateFilter();
        this.updateSellPriceFilter();
        this.updateDaysPassedFilter();
    }

    bindFilterEvents() {
        const filtersRoot = this.mainDashboardCard.querySelector(".filters");
        if (!filtersRoot) return;

        // Handle normal change events (inputs/selects)
        filtersRoot.addEventListener("change", e => {
            const el = e.target;
            const key = el.dataset.filter;
            if (!key) return;

            const transform = TradeDashboard.FILTER_TRANSFORMS[key] || (v => v);

            this.setState({ [key]: transform(el.value) });
        });

        // Handle reset buttons
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

    updateChoices(filter, choices) {
        filter.clearChoices();
        filter.clearStore();
        filter.removeActiveItems();
        filter.setChoices(choices, "value", "label", false);
    }

    updateDayFilter() {
        if (!this.dayFilter) return;

        const days = [...new Set(
            this.tradesData.map(t => getDayName(t.tradeDateTime))
        )].sort();

        const selected = this.state.selectedDays;

        this.updateChoices(
            this.dayFilter,
            days.map(d => ({ value: d, label: d, selected: selected.includes(d) }))
        );

    }

    updateTickerFilter() {
        if (!this.tickerFilter) return;

        const tickers = [...new Set(this.tradesData.map(t => t.ticker))].sort();
        const selected = this.state.selectedTickers;

        this.updateChoices(
            this.tickerFilter,
            tickers.map(t => ({ value: t, label: t, selected: selected.includes(t) }))
        );

    }

    updateTradeTypeFilter() {
        if (!this.tradeTypeFilter) return;

        const types = new Set();

        this.tradesData.forEach(t => {
            if (t.tradeDateTime.toDateString() === t.expireDateTime.toDateString()) {
                types.add("0dte");
            } else {
                types.add("swing");
                if (t.optionPriceHighs?.some(h =>
                    h.highDateTime.toDateString() === t.tradeDateTime.toDateString()
                )) {
                    types.add("swing-day");
                }
            }
        });

        const available = [...types];
        const selected = this.state.selectedTradeTypes;

        const labels = {
            swing: "Swing",
            "swing-day": "Swing → Day",
            "0dte": "0DTE"
        };

        this.updateChoices(
            this.tradeTypeFilter,
            available.map(v => ({
                value: v,
                label: labels[v],
                selected: selected.includes(v)
            }))
        );

    }



    updateDateFilter() {
        if (!this.tradesData.length) return;

        const tradeDates = this.tradesData
            .map(t => t.tradeDateTime)
            .filter(d => d instanceof Date && !isNaN(d));

        if (!tradeDates.length) return;

        const minTradeDate = new Date(Math.min(...tradeDates));
        const maxTradeDate = new Date(Math.max(...tradeDates));

        const { startDateFilterEl, endDateFilterEl } = this.el;

        let nextStart = this.state.startDate;
        let nextEnd = this.state.endDate;

        if (!nextStart || minTradeDate < nextStart) {
            nextStart = minTradeDate;
        }

        if (!nextEnd || maxTradeDate > nextEnd) {
            nextEnd = maxTradeDate;
        }

        const changed =
            (!this.state.startDate || nextStart.getTime() !== this.state.startDate.getTime()) ||
            (!this.state.endDate || nextEnd.getTime() !== this.state.endDate.getTime());

        if (!changed) return;

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
            if (this.state.selectedSellPrice !== 0) this.setState({ selectedSellPrice: 0 });
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
        const sel = this.state.selectedSellPrice;
        if (sel !== "avg" && sel !== "median" && sel >= maxHighs) {
            this.setState({ selectedSellPrice: 0 });
            sellPriceFilterEl.value = "0";
        } else {
            sellPriceFilterEl.value = String(sel);
        }
    }

    updateDaysPassedFilter() {
        const { daysPassedFilterEl } = this.el;
        if (!this.tradesData.length || !daysPassedFilterEl) return;

        let maxDays = 0;

        // Loop over all trades and their highs to find the maximum days difference
        this.tradesData.forEach(trade => {
            if (!(trade.tradeDateTime instanceof Date)) return;
            if (!trade.optionPriceHighs?.length) return;

            const tradeDay = new Date(
                trade.tradeDateTime.getFullYear(),
                trade.tradeDateTime.getMonth(),
                trade.tradeDateTime.getDate()
            );

            trade.optionPriceHighs.forEach(high => {
                if (!(high.highDateTime instanceof Date)) return;

                const highDay = new Date(
                    high.highDateTime.getFullYear(),
                    high.highDateTime.getMonth(),
                    high.highDateTime.getDate()
                );

                const daysDiff = Math.floor((highDay - tradeDay) / 86400000);
                if (daysDiff > maxDays) maxDays = daysDiff;
            });
        });

        // Build dropdown options
        daysPassedFilterEl.innerHTML =
            `<option value="0">Same Day</option>` +
            Array.from({ length: maxDays }, (_, i) => {
                const d = i + 1;
                return `<option value="${d}">${d} Day${d > 1 ? "s" : ""}</option>`;
            }).join("");

        // Preserve user selection if valid, otherwise default to maxDays
        const current = this.state.maxDaysPassed;
        const nextValue =
            Number.isFinite(current) && current <= maxDays
                ? current
                : maxDays;

        if (nextValue !== current) {
            this.setState({ maxDaysPassed: nextValue });
        }

        daysPassedFilterEl.value = String(nextValue);
    }


    updateAllDynamicFilters() {

        this.updateDateFilter();
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
            .then(newHigh => {
                // Normalize for frontend usage (camelCase)
                newHigh.highDateTime = new Date(newHigh.high_datetime);
                trade.optionPriceHighs.push(newHigh);
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

    getCalendarDayDiff(dateA, dateB) {
        const a = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
        const b = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
        return Math.floor((b - a) / 86400000);
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
