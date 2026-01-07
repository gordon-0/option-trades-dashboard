// js/state/store.js
export const state = {
  trades: [],
  filters: {
    startDate: null,
    endDate: null,
    verified: "all",
    tradeType: "all",
    sortOrder: "newest",
    sellIndex: 0,
    maxHighTime: "",
    maxDaysPassed: NaN,
    maxGainPercent: NaN,
    selectedDays: [],
    selectedTickers: []
  }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function updateFilters(patch) {
  Object.assign(state.filters, patch);
  listeners.forEach(fn => fn(state));
}
