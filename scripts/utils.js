// --- Application State (will be initialized in app.js) ---
let state = {};
export function initStateUtils(appState) {
    state = appState;
}

// --- Formatting & Parsing ---
export function formatCurrency(amount, currencyCode, compact = false) {
    if (state.isPrivacyMode) return '*****';
    if (typeof amount !== 'number' || isNaN(amount)) return '-';
    
    const finalCurrencyCode = (currencyCode && typeof currencyCode === 'string' && currencyCode.length >= 3) ? currencyCode : state.appSettings.mainCurrency;
    const options = { style: 'currency', currency: finalCurrencyCode };
    
    if (compact) {
        options.notation = 'compact';
        options.compactDisplay = 'short';
    }

    try {
        return new Intl.NumberFormat('en-US', options).format(amount);
    } catch (e) {
        console.warn(`Invalid currency code: ${finalCurrencyCode}. Falling back to USD.`);
        options.currency = 'USD';
        return new Intl.NumberFormat('en-US', options).format(amount);
    }
}

export function parseDate(dateString) {
    if (!dateString) return null;
    // Handles YYYY-MM-DD format correctly by treating it as local time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return new Date(dateString + 'T00:00:00');
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

// --- Charting ---
export function getChartColors(isDark) {
    return {
        grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        ticks: isDark ? '#9ca3af' : '#6b7280',
        labels: isDark ? '#d1d5db' : '#374151',
        pie: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280', '#ec4899']
    };
}

export function renderGainLossDisplay(amountEl, percentEl, amount, percentage, currency) {
    const isGain = amount >= 0;
    const colorClass = isGain ? 'text-green-500' : 'text-red-500';
    
    amountEl.textContent = formatCurrency(amount, currency);
    percentEl.textContent = state.isPrivacyMode ? `(**.**%)` : `(${percentage.toFixed(2)}%)`;
    
    amountEl.className = `text-xl font-bold ${colorClass}`;
    percentEl.className = `text-sm font-medium ${colorClass}`;
}


// --- Currency Conversion ---
export function convertCurrency(amount, from, to, rates) {
    if (!from || !to || !rates || Object.keys(rates).length === 0) return null;

    from = from.toUpperCase();
    to = to.toUpperCase();
    
    if (!rates[from] || !rates[to]) return null;
    if (from === to) return amount;
    
    // Assumes the base currency in the rates object is USD
    const amountInUSD = amount / rates[from];
    return amountInUSD * rates[to];
}

export const COMMON_CURRENCIES = { "USD": "United States Dollar", "EUR": "Euro", "JPY": "Japanese Yen", "GBP": "British Pound Sterling", "AUD": "Australian Dollar", "CAD": "Canadian Dollar", "CHF": "Swiss Franc", "CNY": "Chinese Yuan", "HKD": "Hong Kong Dollar", "NZD": "New Zealand Dollar", "SEK": "Swedish Krona", "KRW": "South Korean Won", "SGD": "Singapore Dollar", "NOK": "Norwegian Krone", "MXN": "Mexican Peso", "INR": "Indian Rupee", "RUB": "Russian Ruble", "ZAR": "South African Rand", "BRL": "Brazilian Real", "PHP": "Philippine Peso", "SAR": "Saudi Riyal" };