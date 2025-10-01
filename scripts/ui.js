import * as utils from './utils.js';

let dom = {};
let state = {};
let chartInstances = {};

export function initUI(appState) {
    state = appState;
    cacheDOMElements();
    return dom;
}

function cacheDOMElements() {
    dom = {
        docElement: document.documentElement,
        tabContents: document.querySelectorAll('.tab-content'),
        tabButtons: document.querySelectorAll('.tab-button'),
        transactionModal: document.getElementById('transaction-modal'),
        dividendModal: document.getElementById('dividend-modal'),
        settingsModal: document.getElementById('settings-modal'),
        alertModal: document.getElementById('alert-modal'),
        confirmModal: document.getElementById('confirm-modal'),
        assetDetailModal: document.getElementById('asset-detail-modal'),
        transactionForm: document.getElementById('transaction-form'),
        dividendForm: document.getElementById('dividend-form'),
        mainCurrencySelect: document.getElementById('main-currency'),
        themeToggleBtn: document.getElementById('theme-toggle'),
        themeToggleDarkIcon: document.getElementById('theme-toggle-dark-icon'),
        themeToggleLightIcon: document.getElementById('theme-toggle-light-icon'),
        loadingOverlay: document.getElementById('loading-overlay'),
        toastContainer: document.getElementById('toast-container'),
        assetList: document.getElementById('asset-list'),
        noAssetsMessage: document.getElementById('no-assets-message'),
        dividendsList: document.getElementById('dividends-list'),
        noDividendsMessage: document.getElementById('no-dividends-message'),
        summaryTableBody: document.getElementById('summary-table-body'),
        summaryTableFooter: document.getElementById('summary-table-footer'),
    };
}

export function applyTheme(theme) {
    dom.docElement.classList.toggle('dark', theme === 'dark');
    dom.themeToggleLightIcon.classList.toggle('hidden', theme === 'dark');
    dom.themeToggleDarkIcon.classList.toggle('hidden', theme !== 'dark');
}

export function switchTab(tabName, renderCallback) {
    dom.tabContents.forEach(el => el.classList.add('hidden'));
    dom.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    document.getElementById(`${tabName}-content`).classList.remove('hidden');
    document.getElementById('add-transaction-fab').classList.toggle('hidden', tabName === 'summary' || tabName === 'dividends');
    state.currentTab = tabName;
    renderCallback();
}

let confirmResolve = null;
export function openModal(modalElement) { modalElement.classList.remove('hidden'); }
export function closeModal(modalElement) { modalElement.classList.add('hidden'); }

export function initModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(closeModal);
    });
    document.getElementById('cancel-transaction-btn').addEventListener('click', () => closeModal(dom.transactionModal));
    document.getElementById('cancel-dividend-btn').addEventListener('click', () => closeModal(dom.dividendModal));
    document.getElementById('cancel-settings-btn').addEventListener('click', () => closeModal(dom.settingsModal));
    document.getElementById('alert-modal-ok-btn').addEventListener('click', () => closeModal(dom.alertModal));
    document.getElementById('close-asset-detail-btn').addEventListener('click', () => closeModal(dom.assetDetailModal));
    document.getElementById('confirm-modal-ok-btn').addEventListener('click', () => { if (confirmResolve) confirmResolve(true); closeModal(dom.confirmModal); });
    document.getElementById('confirm-modal-cancel-btn').addEventListener('click', () => { if (confirmResolve) confirmResolve(false); closeModal(dom.confirmModal); });
}

export function showAlert(message, title = 'Info') {
    document.getElementById('alert-modal-title').textContent = title;
    document.getElementById('alert-modal-message').textContent = message;
    openModal(dom.alertModal);
}

export function showConfirm(message, title = 'Are you sure?') {
    return new Promise(resolve => {
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;
        confirmResolve = resolve;
        openModal(dom.confirmModal);
    });
}

export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type} text-white p-3 rounded-lg shadow-lg text-sm`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

export function showLoading(show) { dom.loadingOverlay.classList.toggle('hidden', !show); }

export function updateRatesStatus(isOnline, lastUpdated) {
    const onlineIndicator = document.getElementById('online-indicator');
    const ratesLastUpdated = document.getElementById('rates-last-updated');
    const ratesStatusModal = document.getElementById('rates-status-modal');
    let statusText;
    if (!isOnline) {
        onlineIndicator.className = 'h-2 w-2 rounded-full bg-red-500 mr-1.5';
        statusText = lastUpdated ? `Offline. Last sync: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Offline. Rate data unavailable.';
    } else {
        onlineIndicator.className = lastUpdated ? 'h-2 w-2 rounded-full bg-green-500 mr-1.5' : 'h-2 w-2 rounded-full bg-yellow-500 mr-1.5';
        statusText = lastUpdated ? `Rates updated: ${new Date(lastUpdated).toLocaleString()}` : 'Fetching rates...';
    }
    ratesLastUpdated.textContent = statusText;
    if (ratesStatusModal) ratesStatusModal.textContent = statusText;
}

export function updatePrivacyView(isPrivacyMode) {
    document.getElementById('privacy-on-icon').classList.toggle('hidden', isPrivacyMode);
    document.getElementById('privacy-off-icon').classList.toggle('hidden', !isPrivacyMode);
}

export function openTransactionModal(asset = null) {
    dom.transactionForm.reset();
    state.isEditMode = !!asset;
    state.currentEditId = asset ? asset.id : null;
    document.getElementById('transaction-modal-title').textContent = state.isEditMode ? 'Edit Transaction' : 'Add Transaction';
    
    const assetNameInput = document.getElementById('asset-name-modal');
    const assetCategoryWrapper = document.getElementById('asset-type-category-wrapper-modal');
    const assetName = asset ? asset.name : '';

    const handleNameInput = () => {
        const currentName = assetNameInput.value.trim();
        const existingAsset = state.allAssets.find(a => a.name === currentName);
        assetCategoryWrapper.classList.toggle('hidden', !!existingAsset);
    };

    assetNameInput.removeEventListener('input', handleNameInput); // Remove old listener to prevent duplicates
    assetNameInput.addEventListener('input', handleNameInput);
    
    if (asset) {
        assetNameInput.value = asset.name;
        document.getElementById('asset-currency-modal').value = asset.currency;
        document.getElementById('asset-category-modal').value = asset.category;
        document.getElementById('purchase-date-modal').value = asset.purchaseDate;
        document.getElementById('asset-description-modal').value = asset.description || '';
        document.getElementById('asset-type-category-modal').value = asset.assetCategory || '';
        
        const allTxs = state.allAssets.filter(a => a.name === asset.name).sort((a,b) => utils.parseDate(a.purchaseDate) - utils.parseDate(b.purchaseDate));
        const index = allTxs.findIndex(t => t.id === asset.id);
        const prevValue = index > 0 ? allTxs[index-1].value : 0;
        
        if (asset.category === 'Deposit') document.getElementById('asset-value-modal').value = asset.value - prevValue;
        else if (asset.category === 'Withdrawal') document.getElementById('asset-value-modal').value = prevValue - asset.value;
        else document.getElementById('asset-value-modal').value = asset.value;
        
        assetCategoryWrapper.classList.add('hidden');
    } else {
        document.getElementById('purchase-date-modal').value = new Date().toISOString().split('T')[0];
        assetCategoryWrapper.classList.remove('hidden');
    }
    openModal(dom.transactionModal);
}

export function openDividendModal(dividend = null) {
    dom.dividendForm.reset();
    state.isEditMode = !!dividend;
    state.currentEditId = dividend ? dividend.id : null;
    document.getElementById('dividend-modal-title').textContent = state.isEditMode ? 'Edit Dividend' : 'Add Dividend';
    if(dividend) {
        document.getElementById('edit-dividend-id').value = dividend.id;
        document.getElementById('dividend-asset-name-modal').value = dividend.name;
        document.getElementById('dividend-date-modal').value = dividend.date;
        document.getElementById('dividend-value-modal').value = dividend.value;
        document.getElementById('dividend-currency-modal').value = dividend.currency;
        document.getElementById('dividend-description-modal').value = dividend.description || '';
    } else {
        document.getElementById('dividend-date-modal').value = new Date().toISOString().split('T')[0];
    }
    openModal(dom.dividendModal);
}

function destroyAllCharts() {
    Object.keys(chartInstances).forEach(destroyChart);
}

function destroyChart(name) {
    if (chartInstances[name]) {
        chartInstances[name].destroy();
        delete chartInstances[name];
    }
}

export function renderDashboard() {
    destroyAllCharts();
    updateTotalValue();
    renderAllocationChart();
    renderTrendChart();
    renderGainLossChart();
    renderMonthlyIncomeChart();
    renderCashFlowSummary();
    renderAssetBreakdown();
}

function updateTotalValue() {
    const { allAssets, appSettings } = state;
    const mainCurrency = appSettings.mainCurrency;

    const latestAssets = Object.values(allAssets.reduce((acc, tx) => {
        if (!acc[tx.name] || new Date(tx.purchaseDate) >= new Date(acc[tx.name].purchaseDate)) {
            acc[tx.name] = tx;
        }
        return acc;
    }, {}));

    const totalValue = latestAssets.reduce((sum, asset) => {
        const converted = utils.convertCurrency(asset.value, asset.currency, mainCurrency, appSettings.rates);
        return sum + (converted || 0);
    }, 0);

    document.getElementById('total-value').textContent = utils.formatCurrency(totalValue, mainCurrency);
    // You would add the gain/loss calculation logic here as well
}

function renderAllocationChart() {
    destroyChart('allocation');
    const ctx = document.getElementById('allocationChart').getContext('2d');
    const latestAssets = Object.values(state.allAssets.reduce((acc, tx) => { acc[tx.name] = tx; return acc; }, {}));
    
    const allocationData = latestAssets.reduce((acc, asset) => {
        const category = asset.assetCategory || 'Other';
        const value = utils.convertCurrency(asset.value, asset.currency, state.appSettings.mainCurrency, state.appSettings.rates) || 0;
        acc[category] = (acc[category] || 0) + value;
        return acc;
    }, {});

    chartInstances.allocation = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(allocationData),
            datasets: [{
                data: Object.values(allocationData),
                backgroundColor: utils.getChartColors(dom.docElement.classList.contains('dark')).pie,
                borderWidth: 0,
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { display: false } }
        }
    });
}

function renderTrendChart() {
    destroyChart('trend');
    const ctx = document.getElementById('trendChart').getContext('2d');
    const { allAssets, appSettings } = state;
    if (allAssets.length === 0) return;

    const dataPoints = {};
    const assetValues = {};
    allAssets.forEach(tx => {
        assetValues[tx.name] = tx;
        const totalValue = Object.values(assetValues).reduce((sum, asset) => sum + (utils.convertCurrency(asset.value, asset.currency, appSettings.mainCurrency, appSettings.rates) || 0), 0);
        dataPoints[tx.purchaseDate] = totalValue;
    });

    const labels = Object.keys(dataPoints).sort();
    const data = labels.map(label => dataPoints[label]);
    const colors = utils.getChartColors(dom.docElement.classList.contains('dark'));

    chartInstances.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Portfolio Value',
                data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: colors.grid }, ticks: { color: colors.ticks, callback: (v) => utils.formatCurrency(v, appSettings.mainCurrency, true) } },
                x: { grid: { color: colors.grid }, ticks: { color: colors.ticks } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderGainLossChart() { destroyChart('gainLoss'); /* ... full implementation ... */ }
function renderMonthlyIncomeChart() { destroyChart('monthlyIncome'); /* ... full implementation ... */ }
function renderCashFlowSummary() { /* ... full implementation ... */ }
function renderAssetBreakdown() { /* ... full implementation ... */ }


export function renderTracker(assetsToRender) {
    dom.assetList.innerHTML = '';
    const hasAssets = assetsToRender && assetsToRender.length > 0;
    dom.noAssetsMessage.classList.toggle('hidden', hasAssets);
    if (!hasAssets) return;

    const grouped = assetsToRender.reduce((acc, asset) => {
        const monthKey = new Date(asset.purchaseDate).toLocaleString('default', { month: 'long', year: 'numeric' });
        (acc[monthKey] = acc[monthKey] || []).push(asset);
        return acc;
    }, {});

    Object.keys(grouped).forEach(monthName => {
        const monthContainer = document.createElement('div');
        monthContainer.className = 'bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md mb-6';
        monthContainer.innerHTML = `<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">${monthName}</h3>`;
        const transactionsHtml = grouped[monthName].map(tx => `
            <div data-id="${tx.id}" class="transaction-item py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div class="flex justify-between items-center">
                     <div><p class="font-semibold">${tx.name}</p><p class="text-sm text-gray-500">${new Date(tx.purchaseDate).toLocaleDateString()}</p></div>
                     <div class="text-right"><p class="font-semibold">${utils.formatCurrency(tx.value, tx.currency)}</p></div>
                </div>
                <div class="mt-2 flex justify-between items-end">
                    <p class="text-xs text-gray-600">${tx.category}</p>
                    <div class="flex space-x-2"><button class="edit-btn text-sm text-blue-500">Edit</button><button class="delete-btn text-sm text-red-500">Delete</button></div>
                </div>
            </div>`).join('');
        monthContainer.innerHTML += `<div class="space-y-1">${transactionsHtml}</div>`;
        dom.assetList.appendChild(monthContainer);
    });
}

export function renderDividends(dividendsToRender) {
    dom.dividendsList.innerHTML = '';
    const hasDividends = dividendsToRender && dividendsToRender.length > 0;
    dom.noDividendsMessage.classList.toggle('hidden', hasDividends);
    if(!hasDividends) return;
    
    dom.dividendsList.innerHTML = dividendsToRender.map(d => `
     <div data-id="${d.id}" class="dividend-item p-4 bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
        <div class="flex justify-between">
            <div><p class="font-bold">${d.name}</p><p class="text-sm text-gray-500">${d.date}</p></div>
            <p class="font-bold text-green-500">${utils.formatCurrency(d.value, d.currency)}</p>
        </div>
        <div class="flex justify-end space-x-2 mt-2">
            <button class="edit-dividend-btn text-sm text-blue-500">Edit</button>
            <button class="delete-dividend-btn text-sm text-red-500">Delete</button>
        </div>
     </div>`).join('');
}

export function renderSummary() {
    dom.summaryTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-8">Summary view is not fully implemented yet.</td></tr>`;
}

export function updateDatalists(assets) {
    const uniqueNames = [...new Set(assets.map(a => a.name))].sort();
    document.getElementById('asset-datalist').innerHTML = uniqueNames.map(name => `<option value="${name}"></option>`).join('');
    const assetSelect = document.getElementById('dividend-asset-name-modal');
    assetSelect.innerHTML = '<option value="" disabled selected>Select an existing asset</option>' + uniqueNames.map(name => `<option value="${name}">${name}</option>`).join('');
}