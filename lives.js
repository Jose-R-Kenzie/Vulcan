// lives.js
document.addEventListener('DOMContentLoaded', () => {

  /* -----------------------------
     TAB SWITCHING
  ----------------------------- */
  const tabs = document.querySelectorAll('.lives-nav .side-tab');
  const panels = document.querySelectorAll('.report-tab');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.target;
      panels.forEach(p => p.classList.toggle('active', p.id === target));
    });
  });


  /* -----------------------------
     POPULATE DOORS (DD05–DD65)
  ----------------------------- */
  populateDoors();


  /* -----------------------------
     MAKE TABLES EDITABLE
  ----------------------------- */
  const editableTables = [
    'pending-table',
    'indoors-table',
    'standby-table',
    'closed-floor-table',
    'closed-pallet-table',
    'ncns-table',
    'refused-table',
    'rescheduled-table'
  ];
  makeEditable(editableTables);


  /* -----------------------------
     ADD ROW BUTTONS
  ----------------------------- */
  document.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => addBlankRow(btn.dataset.add));
  });


  /* -----------------------------
     PASTE ROW BUTTONS
  ----------------------------- */
  document.querySelectorAll('[data-paste]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tableId = btn.dataset.paste;
      const line = await promptPasteLine();
      if (line) pasteRow(tableId, line);
    });
  });


  /* -----------------------------
     REFRESH BUTTON
  ----------------------------- */
  document.getElementById('livesRefreshBtn')?.addEventListener('click', () => {
    // Later: reload from backend or JSON store
    showToast('Lives refreshed', 'success');
  });

});



/* ============================================================
   FUNCTIONS
============================================================ */


/* -----------------------------
   MAKE CELLS EDITABLE
----------------------------- */
function makeEditable(ids) {
  ids.forEach(id => {
    const table = document.getElementById(id);
    if (!table) return;

    table.querySelectorAll('tbody tr td').forEach(td => {
      td.setAttribute('contenteditable', 'true');
    });
  });
}


/* -----------------------------
   ADD BLANK ROW
----------------------------- */
function addBlankRow(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const cols = table.querySelectorAll('thead th').length;
  const tr = document.createElement('tr');

  for (let i = 0; i < cols; i++) {
    const td = document.createElement('td');
    td.setAttribute('contenteditable', 'true');
    td.textContent = '';
    tr.appendChild(td);
  }

  const body = table.querySelector('tbody');
  const placeholder = body.querySelector('tr td[colspan]');
  if (placeholder) body.innerHTML = '';

  body.appendChild(tr);
}


/* -----------------------------
   PASTE ROW (TSV/CSV)
----------------------------- */
async function promptPasteLine() {
  return prompt('Paste a single row (TSV or CSV):');
}

function pasteRow(tableId, line) {
  const table = document.getElementById(tableId);
  if (!table || !line) return;

  const parts = line.includes('\t') ? line.split('\t') : line.split(',');
  const cols = table.querySelectorAll('thead th').length;

  const tr = document.createElement('tr');
  for (let i = 0; i < cols; i++) {
    const td = document.createElement('td');
    td.setAttribute('contenteditable', 'true');
    td.textContent = (parts[i] ?? '').trim();
    tr.appendChild(td);
  }

  const body = table.querySelector('tbody');
  const placeholder = body.querySelector('tr td[colspan]');
  if (placeholder) body.innerHTML = '';

  body.appendChild(tr);
}


/* -----------------------------
   POPULATE DOORS TABLE
----------------------------- */
function populateDoors() {
  const exclude = new Set([11,19,22,23,24,27,35,43,51,57,58,59]);
  const body = document.querySelector('#indoors-table tbody');
  if (!body) return;

  body.innerHTML = '';

  for (let d = 5; d <= 65; d++) {
    if (exclude.has(d)) continue;

    const door = `DD${String(d).padStart(2, '0')}`;
    const tr = document.createElement('tr');

    const cols = ['Door', 'ISA', 'Arrived', 'Sent', 'Freight'];
    cols.forEach((col, idx) => {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.textContent = idx === 0 ? door : '';
      tr.appendChild(td);
    });

    body.appendChild(tr);
  }
}


/* -----------------------------
   TOAST NOTIFICATIONS
----------------------------- */
let toastTimer = null;

function showToast(message, kind = 'success', ms = 2500) {
  let toast = document.getElementById('toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.className = `toast ${kind}`;
  toast.textContent = message;
  toast.style.display = 'block';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
    toast.style.display = 'none';
    toast.textContent = '';
  }, ms);
}