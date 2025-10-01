// Dexie.js Database Setup
export const db = new Dexie('AssetTrackerDB');

db.version(2).stores({
    assets: '++id, name, purchaseDate, category', // '++id' is an auto-incrementing primary key
    dividends: '++id, name, date',
    settings: 'key' // Using 'key' as the primary key for a key-value store
});

// --- Settings Functions ---
export async function getSettings() {
    const settings = await db.settings.get('appSettings');
    // Return default settings if none are found
    return settings || {
        mainCurrency: 'USD',
        rates: {},
        lastUpdated: null,
    };
}

export async function saveSettings(settings) {
    return await db.settings.put({ key: 'appSettings', ...settings });
}

// --- Asset Functions ---
export async function getAllAssets() {
    return await db.assets.orderBy('purchaseDate').toArray();
}

export async function getAssetById(id) {
    return await db.assets.get(id);
}

export async function saveAsset(asset) {
    return await db.assets.put(asset);
}

export async function deleteAsset(id) {
    return await db.assets.delete(id);
}

export async function bulkAddAssets(assetsArray) {
    // Dexie's bulkAdd doesn't update, so we use bulkPut
    return await db.assets.bulkPut(assetsArray);
}

export async function clearAssets() {
    return await db.assets.clear();
}


// --- Dividend Functions ---
export async function getAllDividends() {
    return await db.dividends.orderBy('date').toArray();
}

export async function getDividendById(id) {
    return await db.dividends.get(id);
}

export async function saveDividend(dividend) {
    return await db.dividends.put(dividend);
}

export async function deleteDividend(id) {
    return await db.dividends.delete(id);
}

export async function bulkAddDividends(dividendsArray) {
    return await db.dividends.bulkPut(dividendsArray);
}

export async function clearDividends() {
    return await db.dividends.clear();
}