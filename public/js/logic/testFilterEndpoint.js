
/**
 * Calls the /trades/filtered endpoint with dummy data for testing
 * @returns {Promise<{ trades: Array, availableFilters: Object }>} normalized trades and available filters
 */
export async function testFilterEndpoint() {
    try {
        // Dummy filter payload
        const dummyPayload = {
            startDate: new Date("2025-01-01").toISOString(),
            endDate: new Date("2025-12-31").toISOString(),
            verified: "all",
            tickers: [],
            tradeTypes: [],
            daysOfWeek: [],
            sortBy: 'newest' // matches backend
        };

        const res = await fetch("/trades/filtered", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dummyPayload)
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();

        console.log("Raw filtered trades result:", data.trades);
        console.log("Available filters:", data.availableFilters);


        return {
            trades: data.trades,
            availableFilters: data.availableFilters
        };
    } catch (err) {
        console.error("Error calling testFilterEndpoint:", err);
        return {
            trades: [],
            availableFilters: {}
        };
    }
}
