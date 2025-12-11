// lives.js
document.addEventListener('DOMContentLoaded', () => {
  // Make table cells editable
  makeEditable(['pending-table','indoors-table','standby-table','closed-floor-table','closed-pallet-table','ncns-table','refused-table','rescheduled-table']);

  // Wire Add row buttons
  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => addBlankRow(btn.dataset.add));
  });

  // Wire Paste row buttons (accept TSV/CSV line)
  document.querySelectorAll('[data-paste]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tableId = btn.dataset.paste;
      const line = await promptPasteLine();
      if (line) pasteRow(tableId, line);
    });
  });

  // Generate doors DD05–DD65 excluding emergency/compactor
  populateDoors();

  // Refresh button: later hook to your data source
  document.getElementById('livesRefreshBtn')?.addEventListener('click', () => {
    // TODO: reload from JSON store and repopulate tables
    showToast('Lives refreshed', 'success');
  });
});

/* Editable cells */
function makeEditable(ids){
  ids.forEach(id => {
    const table = document.getElementById(id);
    if (!table) return;
    table.querySelectorAll('tbody tr td').forEach(td => td.setAttribute('contenteditable','true'));
  });
}

/* Add blank row based on table header columns */
function addBlankRow(tableId){
  const table = document.getElementById(tableId);
  if (!table) return;
  const cols = table.querySelectorAll('thead th').length;
  const tr = document.createElement('tr');
  for (let i=0;i<cols;i++){
    const td = document.createElement('td');
    td.setAttribute('contenteditable','true');
    td.textContent = '';
    tr.appendChild(td);
  }
  // remove placeholder row if present
  const body = table.querySelector('tbody');
  const placeholder = body.querySelector('tr td[colspan]');
  if (placeholder) body.innerHTML = '';
  body.appendChild(tr);
}

/* Prompt paste (supports clipboard and manual) */
async function promptPasteLine(){
  const manual = prompt('Paste a single row (TSV/CSV):');
  return manual;
}

/* Paste row: normalize CSV/TSV into cells */
function pasteRow(tableId, line){
  const table = document.getElementById(tableId);
  if (!table || !line) return;
  // detect delimiter: tab or comma
  const parts = line.includes('\t') ? line.split('\t') : line.split(',');
  const cols = table.querySelectorAll('thead th').length;
  const tr = document.createElement('tr');
  for (let i=0;i<cols;i++){
    const td = document.createElement('td');
    td.setAttribute('contenteditable','true');
    td.textContent = (parts[i] ?? '').trim();
    tr.appendChild(td);
  }
  // remove placeholder row
  const body = table.querySelector('tbody');
  const placeholder = body.querySelector('tr td[colspan]');
  if (placeholder) body.innerHTML = '';
  body.appendChild(tr);
}

/* Doors population DD05–DD65 excluding [11,19,22,23,24,27,35,43,51,57,58,59] */
function populateDoors(){
  const exclude = new Set([11,19,22,23,24,27,35,43,51,57,58,59]);
  const body = document.querySelector('#indoors-table tbody');
  if (!body) return;
  body.innerHTML = ''; // clear
  for (let d=5; d<=65; d++){
    if (exclude.has(d)) continue;
    const door = `DD${String(d).padStart(2,'0')}`;
    const tr = document.createElement('tr');
    ['Door','ISA','Arrived','Sent','Freight'].forEach((col, idx) => {
      const td = document.createElement('td');
      td.setAttribute('contenteditable','true');
      td.textContent = idx === 0 ? door : '';
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}

/* Simple toast (reuse styles.css .toast) */
let toastTimer=null;
function showToast(message, kind='success', ms=2000){
  let toast = document.getElementById('toast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  clearTimeout(toastTimer);
  toast.style.display = 'block';
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
    toast.style.display = 'none';
    toast.textContent = '';
  }, ms);
}