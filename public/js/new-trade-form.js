class NewTradeForm {
    constructor(formId) {
        this.form = document.getElementById(formId);

        this.tradeDate = document.getElementById("date");
        this.tradeTime = document.getElementById("time"); // new time field
        this.expireDate = document.getElementById("expire-date");
        this.verifiedInput = document.getElementById("verified");

        this.initFormDefaults();
        this.initEventListeners();
    }

    initFormDefaults() {
        const today = new Date().toISOString().slice(0, 10);
        /*         this.tradeDate.value = today;
                this.expireDate.value = today;*/
        this.tradeDate.value = "2025-07-18";
        this.expireDate.value = "2025-07-18";
        this.tradeTime.value = "";
    }

    /**
     * Converts a US market date (YYYY-MM-DD) to a UTC ISO string,
     * anchored to America/New_York at the given hour/minute.
     * Fully DST-safe.
     */
    marketDateToUTC(dateStr, hour, minute) {
        const [y, m, d] = dateStr.split("-").map(Number);

        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

        const parts = formatter.formatToParts(
            new Date(Date.UTC(y, m - 1, d, hour, minute, 0))
        );

        const get = (type) => parts.find(p => p.type === type).value;

        return new Date(Date.UTC(
            Number(get("year")),
            Number(get("month")) - 1,
            Number(get("day")),
            Number(get("hour")),
            Number(get("minute")),
            Number(get("second"))
        )).toISOString();
    }

    async handleSubmit(e) {
        e.preventDefault();

        // ✅ Combine user-entered date and time into a single UTC timestamp
        const tradeDateTimeUTC = new Date(
            `${this.tradeDate.value}T${this.tradeTime.value || '00:00'}`
        ).toISOString();

        // Expire date → NY market close, DST-safe
        const expireDateTimeUTC = this.marketDateToUTC(this.expireDate.value, 16, 0);

        const newTrade = {
            trader: document.getElementById("trader").value,
            ticker: document.getElementById("ticker").value.toUpperCase(),
            average_entry: parseFloat(document.getElementById("avg-entry").value),
            strike_price: parseFloat(document.getElementById("strike-price").value),
            option_type: document.getElementById("option-type").value,

            trade_datetime: tradeDateTimeUTC,
            expire_datetime: expireDateTimeUTC,

            verified: this.verifiedInput.value === "true",
            option_price_highs: [],
            high_override_id: null,
            excluded: false,
            treat_as_loss: false,
        };

        try {
            const res = await fetch("/trades", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTrade)
            });

            if (!res.ok) throw new Error("Failed to save trade");

                const savedTrade = await res.json(); 
                const tradeId = savedTrade.id; 

            await window.tradeDashboard.reloadTrades();


            alert(`Trade for ${newTrade.ticker} added!`);
            this.resetForm();

            document.dispatchEvent(new CustomEvent("trades:changed", {
                detail: { type: "add", tradeId }
            }));


        } catch (err) {
            console.error(err);
            alert("Failed to save trade.");
        }
    }


    resetForm() {
        this.form.reset();
        this.initFormDefaults();
    }

    initEventListeners() {
        this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new NewTradeForm("new-trade-form");
});
