// A simple reactive state store
export class TradeState {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.listeners = new Set();
    }

    // Read state
    get(key) {
        return this.state[key];
    }

    // Update state with partial changes
    set(partial) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...partial };
        this.notify(prevState, this.state);
    }

    // Subscribe to state changes
    subscribe(callback) {
        this.listeners.add(callback);
        // Return unsubscribe function
        return () => this.listeners.delete(callback);
    }

    // Notify all subscribers
    notify(prevState, nextState) {
        this.listeners.forEach(cb => cb(prevState, nextState));
    }
}
