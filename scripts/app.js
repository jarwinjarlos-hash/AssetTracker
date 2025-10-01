import * as db from './database.js';
import * as ui from './ui.js';
import * as utils from './utils.js';
import * as features from './features.js';

const CURRENCY_API_URL = 'https://open.er-api.com/v6/latest/USD';

const state = { allAssets: [], allDividends: [], appSettings: {}, isPrivacyMode: false, currentTab: 'dashboard', isEditMode: false, currentEditId: null };

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    ui.showLoading(true);
    const dom = ui.initUI(state);
    utils.initStateUtils(state);
    ui.initModals();
    await loadSettingsAndData();

    ui.updatePrivacyView(state.isPrivacyMode);
    ui.populateCurrencyDatalists();
    dom.mainCurrencySelect.value = state.appSettings.mainCurrency;
    
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    ui.applyTheme(theme);

    setupEventListeners(dom);
    await renderCurrentTab();
    await updateExchangeRates();
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }
    ui.showLoading(false);
}

async function loadSettingsAndData() {
    const [settings, assets, dividends] = await Promise.all([db.getSettings(), db.getAllAssets(), db.getAllDividends()]);
    state.appSettings = settings;
    state.allAssets = assets;
    state.allDividends = dividends;
    state.isPrivacyMode = localStorage.getItem('assetTrackerPrivacyMode') === 'true';
}

async function reloadAndRender() {
    ui.showLoading(true);
    await loadSettingsAndData();
    await renderCurrentTab();
    ui.showLoading(false);
}

function setupEventListeners(dom) {
    dom.themeToggleBtn.addEventListener('click', () => {
        const newTheme = dom.docElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        ui.applyTheme(newTheme);
        renderCurrentTab();
    });

    dom.tabButtons.forEach(button => button.addEventListener('click', () => ui.switchTab(button.dataset.tab, renderCurrentTab)));

    document.getElementById('privacy-toggle-btn').addEventListener('click', () => {
        state.isPrivacyMode = !state.isPrivacyMode;
        localStorage.setItem('assetTrackerPrivacyMode', state.isPrivacyMode);
        ui.updatePrivacyView(state.isPrivacyMode);
        reloadAndRender();
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        dom.mainCurrencySelect.value = state.appSettings.mainCurrency;
        ui.openModal(dom.settingsModal);
    });
    document.getElementById('save-settings-btn').addEventListener('click', handleSaveSettings);

    document.getElementById('export-data-btn').addEventListener('click', () => features.exportBackup(state.allAssets, state.allDividends));
    document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input').addEventListener('change', (e) => {
        features.handleImport(e.target.files[0], reloadAndRender);
        e.target.value = '';
    });
    
    document.getElementById('add-transaction-fab').addEventListener('click', () => ui.openTransactionModal());
    document.getElementById('add-dividend-btn').addEventListener('click', () => ui.openDividendModal());

    dom.transactionForm.addEventListener('submit', handleSaveTransaction);
    dom.dividendForm.addEventListener('submit', handleSaveDividend);

    dom.assetList.addEventListener('click', handleListInteraction);
    dom.dividendsList.addEventListener('click', handleListInteraction);
}

async function handleListInteraction(e) {
    const target = e.target;
    const isAsset = target.closest('.transaction-item');
    const isDividend = target.closest('.dividend-item');
    if (!isAsset && !isDividend) return;

    const item = isAsset || isDividend;
    const id = parseInt(item.dataset.id);

    if (isAsset) {
        if (target.classList.contains('delete-btn')) {
            const confirmed = await ui.showConfirm('Delete this transaction? This will recalculate asset history.');
            if (confirmed) {
                await db.deleteAsset(id);
                ui.showToast('Transaction deleted.', 'success');
                await reloadAndRender();
            }
        } else if (target.classList.contains('edit-btn')) {
            const asset = await db.getAssetById(id);
            if (asset) ui.openTransactionModal(asset);
        }
    } else if (isDividend) {
        if (target.classList.contains('delete-dividend-btn')) {
            const confirmed = await ui.showConfirm('Are you sure you want to delete this dividend?');
            if (confirmed) {
                await db.deleteDividend(id);
                ui.showToast('Dividend deleted.', 'success');
                await reloadAndRender();
            }
        } else if (target.classList.contains('edit-dividend-btn')) {
            const dividend = await db.getDividendById(id);
            if (dividend) ui.openDividendModal(dividend);
        }
    }
}

async function handleSaveSettings() {
    state.appSettings.mainCurrency = document.getElementById('main-currency').value;
    await db.saveSettings(state.appSettings);
    ui.closeModal(document.getElementById('settings-modal'));
    ui.showToast('Settings saved!', 'success');
    await reloadAndRender();
}

async function handleSaveTransaction(e) {
    e.preventDefault();
    const id = state.isEditMode ? state.currentEditId : (Date.now() + Math.random()); // Temporary ID for new items
    const name = document.getElementById('asset-name-modal').value.trim();
    const transactionAmount = parseFloat(document.getElementById('asset-value-modal').value);
    const category = document.getElementById('asset-category-modal').value;
    const date = document.getElementById('purchase-date-modal').value;
    const currency = document.getElementById('asset-currency-modal').value.toUpperCase();
    
    if (!name || isNaN(transactionAmount) || !category || !date || !currency) {
        return ui.showAlert('Please fill all required fields.');
    }
    
    // Create the new/updated transaction object but don't calculate value yet
    const tempTx = {
        id: state.isEditMode ? id : undefined, // Let DB create ID for new
        name, purchaseDate: date, category, transactionAmount, currency,
        description: document.getElementById('asset-description-modal').value,
        createdAt: new Date().toISOString()
    };
    
    // Get all transactions for this specific asset, excluding the one we're editing
    let assetHistory = state.allAssets.filter(a => a.name === name && a.id !== state.currentEditId);
    assetHistory.push(tempTx);
    assetHistory.sort((a,b) => utils.parseDate(a.purchaseDate) - utils.parseDate(b.purchaseDate) || (a.createdAt || 0) - (b.createdAt || 0));

    // Recalculate values for the entire history of this asset
    let previousValue = 0;
    for (const tx of assetHistory) {
        if (!tx.assetCategory) {
            const existingAsset = state.allAssets.find(a => a.name === name);
            tx.assetCategory = existingAsset ? existingAsset.assetCategory : document.getElementById('asset-type-category-modal').value;
        }

        let currentAmount = tx.transactionAmount;
        if (tx.category === 'Deposit') tx.value = previousValue + currentAmount;
        else if (tx.category === 'Withdrawal') tx.value = previousValue - currentAmount;
        else tx.value = currentAmount; // Market Value Update sets the value directly
        
        previousValue = tx.value;
        delete tx.transactionAmount; // remove temporary property
        await db.saveAsset(tx); // Save each updated transaction
    }

    ui.closeModal(document.getElementById('transaction-modal'));
    ui.showToast(`Transaction ${state.isEditMode ? 'updated' : 'saved'}!`, 'success');
    await reloadAndRender();
}

async function handleSaveDividend(e) {
    e.preventDefault();
    const id = state.isEditMode ? state.currentEditId : undefined;
    const newDividend = {
        id,
        name: document.getElementById('dividend-asset-name-modal').value,
        date: document.getElementById('dividend-date-modal').value,
        value: parseFloat(document.getElementById('dividend-value-modal').value),
        currency: document.getElementById('dividend-currency-modal').value.toUpperCase(),
        description: document.getElementById('dividend-description-modal').value
    };
    await db.saveDividend(newDividend);
    ui.closeModal(document.getElementById('dividend-modal'));
    ui.showToast(`Dividend ${state.isEditMode ? 'updated' : 'saved'}!`, 'success');
    await reloadAndRender();
}

async function updateExchangeRates() {
    if (!navigator.onLine) {
        ui.updateRatesStatus(false, state.appSettings.lastUpdated);
        return;
    }
    try {
        ui.updateRatesStatus(true, null);
        const response = await fetch(CURRENCY_API_URL);
        if (!response.ok) throw new Error('Network response error');
        const data = await response.json();
        
        if (data.result === 'success') {
            state.appSettings.rates = data.rates;
            state.appSettings.lastUpdated = new Date().toISOString();
            await db.saveSettings(state.appSettings);
            await renderCurrentTab();
        }
    } catch (error) {
        console.error('Failed to fetch exchange rates:', error);
    } finally {
        ui.updateRatesStatus(navigator.onLine, state.appSettings.lastUpdated);
    }
}

async function renderCurrentTab() {
    ui.updateDatalists(state.allAssets);
    switch (state.currentTab) {
        case 'dashboard':
            ui.renderDashboard(state);
            break;
        case 'tracker':
            ui.renderTracker(state.allAssets);
            break;
        case 'dividends':
            ui.renderDividends(state.allDividends);
            break;
        case 'summary':
            ui.renderSummary(state);
            break;
    }
}