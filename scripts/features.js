import { showToast, showConfirm } from './ui.js';
import * as db from './database.js';

// --- Data Backup & Restore ---

export function exportBackup(allAssets, allDividends) {
    if (allAssets.length === 0 && allDividends.length === 0) {
        showToast('No data to export.', 'info');
        return;
    }

    const zip = new JSZip();

    const assetHeaders = ['id','name','assetCategory','category','purchaseDate','value', 'currency', 'description','createdAt'];
    const assetRows = allAssets.map(asset => 
        assetHeaders.map(header => {
            let cell = asset[header] === null || asset[header] === undefined ? '' : String(asset[header]);
            if (/[",\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
            return cell;
        }).join(',')
    );
    zip.file("assets.csv", [assetHeaders.join(','), ...assetRows].join('\n'));

    const dividendHeaders = ['id', 'name', 'subAssetName', 'date', 'value', 'currency', 'description'];
    const dividendRows = allDividends.map(dividend => 
        dividendHeaders.map(header => {
            let cell = dividend[header] === null || dividend[header] === undefined ? '' : String(dividend[header]);
            if (/[",\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
            return cell;
        }).join(',')
    );
    zip.file("dividends.csv", [dividendHeaders.join(','), ...dividendRows].join('\n'));

    zip.generateAsync({type:"blob"}).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `asset_tracker_backup_${new Date().toISOString().split('T')[0]}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Backup exported successfully!', 'success');
    });
}

export function handleImport(file, onComplete) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const zip = await JSZip.loadAsync(e.target.result);
            const assetsText = await zip.file('assets.csv')?.async('string');
            const dividendsText = await zip.file('dividends.csv')?.async('string');

            if (assetsText) {
                const importedAssets = csvToAssetArray(assetsText);
                const replace = await showConfirm('Found asset data. Replace current assets? (Cancel will merge)', 'Import Assets');
                if (replace) await db.clearAssets();
                await db.bulkAddAssets(importedAssets);
            }
            
            if (dividendsText) {
                const importedDividends = csvToDividendArray(dividendsText);
                const replace = await showConfirm('Found dividend data. Replace current dividends? (Cancel will merge)', 'Import Dividends');
                if (replace) await db.clearDividends();
                await db.bulkAddDividends(importedDividends);
            }

            showToast('Backup imported successfully!', 'success');
            onComplete(); // Callback to refresh the app's data
        } catch (err) {
            showToast('Failed to import backup. Please check file format.', 'error');
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

function csvToAssetArray(csv) {
    const lines = csv.trim().split('\n').slice(1);
    return lines.map(line => {
        const [id, name, assetCategory, category, purchaseDate, value, currency, description, createdAt] = line.split(',');
        const asset = { name, assetCategory, category, purchaseDate, value: parseFloat(value), currency, description, createdAt };
        if (id && !isNaN(parseInt(id))) asset.id = parseInt(id);
        return asset;
    }).filter(Boolean);
}

function csvToDividendArray(csv) {
    const lines = csv.trim().split('\n').slice(1);
    return lines.map(line => {
        const [id, name, subAssetName, date, value, currency, description] = line.split(',');
        const dividend = { name, subAssetName, date, value: parseFloat(value), currency, description };
        if (id && !isNaN(parseInt(id))) dividend.id = parseInt(id);
        return dividend;
    }).filter(Boolean);
}

// --- CSV Export for Summary View ---
export function exportSummaryToCSV(summaryData, settings) {
    if (!summaryData || summaryData.length === 0) {
        showToast('No summary data to export.', 'info');
        return;
    }

    const headers = ['Asset Name', 'Asset Category', `Allocation %`, `Total Deposited (${settings.mainCurrency})`, `Total Withdrawn (${settings.mainCurrency})`, `Gain/Loss (${settings.mainCurrency})`, 'Gain/Loss %', `Total Dividend (${settings.mainCurrency})`];
    const rows = summaryData.map(d => [
        `"${d.assetName}"`, d.assetCategory, d.allocation.toFixed(2), d.totalDeposited, d.totalWithdrawn,
        d.gainLossAmount, d.gainLossPercentage.toFixed(2), d.totalDividend
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `portfolio_summary_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}