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