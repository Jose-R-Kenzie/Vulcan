// reports.js
// Handles tab switching, copy table text, capture table image, and refresh toast.
// Place this file next to reports.html and styles.css

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabs = document.querySelectorAll('.side-tab');
    const tabPanels = document.querySelectorAll('.report-tab');
  
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        // active tab button
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
  
        // switch panels
        const target = btn.dataset.target;
        tabPanels.forEach(p => {
          if (p.id === target) p.classList.add('active');
          else p.classList.remove('active');
        });
      });
    });
  
    // Copy and image buttons
    const controls = document.querySelectorAll('[data-action]');
    controls.forEach(ctrl => {
      ctrl.addEventListener('click', async (e) => {
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
            console.error(err);
            showToast('Failed to copy table data', 'error');
          }
        } else if (action === 'copy-image') {
          try {
            await copyTableAsImage(table);
            showToast('Table image copied to clipboard', 'success');
          } catch (err) {
            console.error(err);
            showToast('Failed to copy table image (browser may require permission)', 'error');
          }
        }
      });
    });
  
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', async () => {
      try {
        await refreshData();
        showToast('Data has been refreshed', 'success');
      } catch (err) {
        console.error(err);
        showToast('Something went wrong. Please try again', 'error');
      }
    });
  
    // expose for dev: a simple function to populate some demo numbers (optional)
    window.populateDemo = populateDemo;
  });
  
  /* ========== Utilities ========== */
  
  function copyTableText(table){
    // Build TSV-like text
    const rows = Array.from(table.querySelectorAll('tr'));
    const lines = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th,td'));
      return cells.map(c => c.textContent.trim()).join('\t');
    });
    const text = lines.join('\n');
  
    // Use Clipboard API
    if (!navigator.clipboard) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } else {
      navigator.clipboard.writeText(text);
    }
  }
  
  async function copyTableAsImage(table){
    // Use html2canvas to turn the table into a canvas, then clipboard
    // Note: navigator.clipboard.write requires a secure context and may need permissions.
    const options = { backgroundColor: null, scale: 1.5, useCORS: true };
    const canvas = await html2canvas(table, options);
    // convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Canvas is empty'));
        const item = new ClipboardItem({ [blob.type]: blob });
        try {
          await navigator.clipboard.write([item]);
          resolve();
        } catch (err) {
          // as fallback, open the image in new tab if clipboard not allowed
          try {
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
          } catch (e) {
            // ignore
          }
          reject(err);
        }
      }, 'image/png');
    });
  }
  
  /* Simulated refresh function
     In your real implementation this should:
     - Re-read local data structures (or load parsed Excel JSON)
     - Recompute counters
     - Update DOM values
  */
  async function refreshData(){
    // simulate a short async operation
    await new Promise((r) => setTimeout(r, 250));
  
    try {
      // Here you will call your processor functions that read uploaded files
      // and compute the values for each report field.
      // For now, we'll call a demo population function to show it working.
      populateDemo();
      return true;
    } catch (err) {
      throw err;
    }
  }
  
  function populateDemo(){
    // Demo values — replace with real computed data assignment when available
    // SOS
    setText('liveInDoorRollovers', 2);
    setText('liveStandbyRollovers', 1);
    setText('totalLiveRollovers', 3);
    setText('liveFloorloadsExpected', 6);
    setText('liveFloorloadsInDoors', 2);
    setText('livePalletLoadsExpected', 18);
    setText('livePalletsInDoors', 10);
    setText('totalLivesExpected', 24);
    setText('parcelInDoors', 120);
    setText('parcelOnsite', 300);
    setText('parcelsOffsite', 75);
    setText('totalParcelsAvailable', 495);
    setText('dropFloorloadsExpected', 5);
    setText('dropFloorloadsInDoors', 3);
    setText('dropFloorloadsOnsite', 1);
    setText('dropFloorloadsOffsite', 1);
    setText('totalDropFloorAvailable', 5);
    setText('dropPalletsExpected', 40);
    setText('dropPalletsInDoors', 18);
    setText('dropPalletsOnsite', 6);
    setText('dropPalletsOffsite', 2);
    setText('totalDropPalletAvailable', 26);
    setText('transFloorloadsInDoors', 0);
    setText('transTotalTrailerAvailable', 2);
    setText('totalDropLiveUnits', 31);
    setText('totalTransshipUnits', 2);
    setText('totalUnitsAvailable', 33);
    setText('oldestIsa', '123456');
    setText('oldestIsaLocation', 'Dock 7');
    setText('oldestIsaDwellTime', '4h 12m');
    setText('totalEmptySlips', 6);
    setText('azngPast72Hrs', 0);
  
    // Hourly: random small demo
    for(let i=0;i<24;i++){
      setText(`hour-${i}`, Math.floor(Math.random()*8));
    }
  
    // Yard values
    setText('yard-floorloads', 12);
    setText('yard-pallets', 340);
    setText('yard-parcels', 800);
    setText('yard-trans', 5);
  }
  
  function setText(id, value){
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  
  /* Toast notifications */
  let toastTimer = null;
  function showToast(message, kind='success', ms=3000){
    const toast = document.getElementById('toast');
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.className = 'toast';
      toast.style.display = 'none';
      toast.textContent = '';
    }, ms);
    toast.style.display = 'block';
  }
  