// js/logic/helpers.js

/* ===== HELPERS ===== */

export function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


export function getDayName(date) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
}


export function formatMs(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    let result = "";
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    return result;
}


export function formatTimeAMPM(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}


export function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/* ===========================
   MATH / STATS HELPERS
   =========================== */

export function calculateAverage(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

export function calculateMedian(arr) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

/* ===========================
   PRICE HELPERS
   =========================== */

export function calculatePercentFromPrice(avgEntry, price) {
    return ((price - avgEntry) / avgEntry) * 100;
}

export function formatPL({
    dollars = null,
    percent = null,
    decimals = 2,
    zeroClass = "profit-green"
} = {}) {
    const valueForClass = dollars ?? percent ?? 0;

    const plClass =
        valueForClass > 0
            ? "profit-green"
            : valueForClass < 0
                ? "loss-red"
                : zeroClass;

    const formatValue = v =>
        v == null
            ? null
            : `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(decimals)}`;

    return {
        dollars: dollars != null ? `${dollars >= 0 ? "+" : "-"}$${Math.abs(dollars).toFixed(decimals)}` : null,
        percent: percent != null ? `(${formatValue(percent)}%)` : null,
        plClass
    };
}


