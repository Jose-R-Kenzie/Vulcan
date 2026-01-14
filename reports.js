// reports.js
// Handles tab switching, copy table text, capture table image, and refresh toast.

document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeCopyButtons();
  initializeRefreshButton();
  
  // Expose demo function for development
  window.populateDemo = populateDemo;
});

/* ========== Tab Management ========== */
function initializeTabs() {
  const tabs = document.querySelectorAll('.side-tab');
  const tabPanels = document.querySelectorAll('.report-tab');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active tab button
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      // Switch panels
      const target = btn.dataset.target;
      tabPanels.forEach(p => {
        if (p.id === target) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    });
  });
}

/* ========== Copy & Image Functionality ========== */
function initializeCopyButtons() {
  const controls = document.querySelectorAll('[data-action]');
  
  controls.forEach(ctrl => {
    ctrl.addEventListener('click', async () => {
      const action = ctrl.dataset.action;
      const targetId = ctrl.dataset.target;
      const table = document.getElementById(targetId);
      
      if (!table) {
        showToast('Could not find the table', 'error');
        return;
      }

      if (action === 'copy-data') {
        try {
          copyTableText(table);
          showToast('Table data copied to clipboard', 'success');
        } catch (err) {
          console.error('Copy error:', err);
          showToast('Failed to copy table data', 'error');
        }
      } else if (action === 'copy-image') {
        try {
          await copyTableAsImage(table);
          showToast('Table image copied to clipboard', 'success');
        } catch (err) {
          console.error('Image copy error:', err);
          showToast('Failed to copy table image (browser may require permission)', 'error');
        }
      }
    });
  });
}

/* ========== Refresh Button ========== */
function initializeRefreshButton() {
  const refreshBtn = document.getElementById('refreshBtn');
  
  if (!refreshBtn) return;
  
  refreshBtn.addEventListener('click', async () => {
    try {
      await refreshData();
      showToast('Data has been refreshed', 'success');
    } catch (err) {
      console.error('Refresh error:', err);
      showToast('Something went wrong. Please try again', 'error');
    }
  });
}

/* ========== Copy Table as Text (TSV) ========== */
function copyTableText(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  const lines = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    return cells.map(c => c.textContent.trim()).join('\t');
  });
  const text = lines.join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/* ========== Copy Table as Image ========== */
async function copyTableAsImage(table) {
  const options = {
    backgroundColor: '#000',
    scale: 2,
    useCORS: true,
    logging: false
  };

  const canvas = await html2canvas(table, options);

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        return reject(new Error('Canvas is empty'));
      }

      try {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        resolve();
      } catch (err) {
        // Fallback: Open image in new tab if clipboard fails
        try {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          resolve();
        } catch (e) {
          reject(err);
        }
      }
    }, 'image/png');
  });
}

/* ========== Data Refresh ========== */
async function refreshData() {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    // TODO: Replace with actual data processing logic
    // This should:
    // 1. Read uploaded files
    // 2. Parse Excel/CSV data
    // 3. Compute report values
    // 4. Update DOM elements
    
    populateDemo();
    return true;
  } catch (err) {
    throw err;
  }
}

/* ========== Demo Data Population ========== */
function populateDemo() {
  // Start of Shift (SOS) values
  const sosData = {
    liveInDoorRollovers: 2,
    liveStandbyRollovers: 1,
    totalLiveRollovers: 3,
    liveFloorloadsExpected: 6,
    liveFloorloadsInDoors: 2,
    livePalletLoadsExpected: 18,
    livePalletsInDoors: 10,
    totalLivesExpected: 24,
    parcelInDoors: 120,
    parcelOnsite: 300,
    parcelsOffsite: 75,
    totalParcelsAvailable: 495,
    dropFloorloadsExpected: 5,
    dropFloorloadsInDoors: 3,
    dropFloorloadsOnsite: 1,
    dropFloorloadsOffsite: 1,
    totalDropFloorAvailable: 5,
    dropPalletsExpected: 40,
    dropPalletsInDoors: 18,
    dropPalletsOnsite: 6,
    dropPalletsOffsite: 2,
    totalDropPalletAvailable: 26,
    transFloorloadsInDoors: 0,
    transFloorloadsOnsite: 0,
    transFloorloadsOffsite: 0,
    transPalletsInDoors: 0,
    transPalletsOnsite: 2,
    transPalletsOffsite: 0,
    transTotalTrailerAvailable: 2,
    totalDropLiveUnits: 31,
    totalTransshipUnits: 2,
    totalUnitsAvailable: 33,
    oldestIsa: '123456',
    oldestIsaLocation: 'Dock 7',
    oldestIsaDwellTime: '4h 12m',
    totalEmptySlips: 6,
    azngPast72Hrs: 0
  };

  // Apply SOS data
  Object.entries(sosData).forEach(([key, value]) => {
    setText(key, value);
  });

  // Yard Freight Mix
  const yardData = {
    'yard-floorloads': 12,
    'yard-pallets': 340,
    'yard-parcels': 800,
    'yard-trans': 5
  };

  Object.entries(yardData).forEach(([key, value]) => {
    setText(key, value);
  });

  // CUTs & Dwells
  const cutsData = {
    'cuts-closed': 2,
    'cuts-open': 7,
    'cuts-indoor': 0,
    'cuts-onsite': 0,
    'cuts-offsite': 7,
    'cuts-tagged': 0,
    'dwells-closed': 27,
    'dwells-open': 148,
    'dwells-indoor': 16,
    'dwells-onsite': 15,
    'dwells-offsite': 117,
    'dwells-tagged': 4
  };

  Object.entries(cutsData).forEach(([key, value]) => {
    setText(key, value);
  });
}

/* ========== Utility Functions ========== */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

/* ========== Toast Notifications ========== */
let toastTimer = null;

function showToast(message, kind = 'success', duration = 3000) {
  const toast = document.getElementById('toast');
  
  if (!toast) return;

  toast.className = `toast ${kind}`;
  toast.textContent = message;
  toast.style.display = 'block';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
    toast.style.display = 'none';
    toast.textContent = '';
  }, duration);
}