// lives.js
document.addEventListener('DOMContentLoaded', () => {

  /* -----------------------------
     LOAD SAVED DATA FIRST
  ----------------------------- */
  loadAllTablesFromLocalStorage();

  /* -----------------------------
     TAB SWITCHING
  ----------------------------- */
  const tabs = document.querySelectorAll('.side-tab[data-target]');
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
     Only populate if table is empty
  ----------------------------- */
  const indoorsBody = document.querySelector('#indoors-table tbody');
  if (indoorsBody && indoorsBody.children.length === 0) {
    populateDoors();
    saveAllTablesToLocalStorage();
  }


  /* -----------------------------
     MAKE TABLES EDITABLE
  ----------------------------- */
  const editableTables = [
    'pending-floor-table',
    'pending-pallet-table',
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
    btn.addEventListener('click', () => {
      addBlankRow(btn.dataset.add);
      updateSidebarCounts();
      saveAllTablesToLocalStorage();
    });
  });


  /* -----------------------------
     PASTE ROW BUTTONS
  ----------------------------- */
  document.querySelectorAll('[data-paste]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tableId = btn.dataset.paste;
      const line = await promptPasteLine();
      if (line) {
        pasteRow(tableId, line);
        updateSidebarCounts();
        saveAllTablesToLocalStorage();
      }
    });
  });


  /* -----------------------------
     REFRESH BUTTON
  ----------------------------- */
  document.getElementById('livesRefreshBtn')?.addEventListener('click', () => {
    showToast('Lives refreshed', 'success');
    updateSidebarCounts();
    saveAllTablesToLocalStorage();
  });


  /* -----------------------------
     INITIAL COUNT UPDATE
  ----------------------------- */
  updateSidebarCounts();
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

      // Save on edit
      td.addEventListener('input', () => {
        saveAllTablesToLocalStorage();
      });
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
  saveAllTablesToLocalStorage();
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
  saveAllTablesToLocalStorage();
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

    const cols = [door, '', '', '', '', '', '', '', '', '', '', ''];

    cols.forEach(value => {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.textContent = value;
      tr.appendChild(td);
    });

    body.appendChild(tr);
  }
}


/* -----------------------------
   SIDEBAR COUNT UPDATES
----------------------------- */
function updateSidebarCounts() {

  setCount('count-pending-floor', '#pending-floor-table', row => {
    const freight = row.querySelector('td:nth-child(12)')?.textContent.trim();
    return freight === 'FL';
  });

  setCount('count-pending-pallet', '#pending-pallet-table', row => {
    const freight = row.querySelector('td:nth-child(12)')?.textContent.trim();
    return ['LP','LP/Mix','NPC','PREP','PR','BOXTRUCK'].includes(freight);
  });

  setCount('count-indoors', '#indoors-table', row => {
    const isa = row.querySelector('td:nth-child(2)')?.textContent.trim();
    return isa !== '';
  });

  setCount('count-standby', '#standby-table');
  setCount('count-closed-floor', '#closed-floor-table');
  setCount('count-closed-pallet', '#closed-pallet-table');
  setCount('count-ncns', '#ncns-table');
  setCount('count-refused', '#refused-table');
  setCount('count-rescheduled', '#rescheduled-table');
}

function setCount(id, selector, filterFn = null) {
  const table = document.querySelector(selector);
  if (!table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr'))
    .filter(row => !row.querySelector('td[colspan]'));

  const count = filterFn ? rows.filter(filterFn).length : rows.length;

  const el = document.getElementById(id);
  if (el) el.textContent = count;
}


/* -----------------------------
   LOCAL STORAGE PERSISTENCE
----------------------------- */
function saveAllTablesToLocalStorage() {
  const tableIds = [
    'pending-floor-table',
    'pending-pallet-table',
    'indoors-table',
    'standby-table',
    'closed-floor-table',
    'closed-pallet-table',
    'ncns-table',
    'refused-table',
    'rescheduled-table'
  ];

  const data = {};

  tableIds.forEach(id => {
    const table = document.getElementById(id);
    if (table) {
      data[id] = table.querySelector('tbody').innerHTML;
    }
  });

  localStorage.setItem('vulcan-lives-data', JSON.stringify(data));
}

function loadAllTablesFromLocalStorage() {
  const saved = localStorage.getItem('vulcan-lives-data');
  if (!saved) return;

  const data = JSON.parse(saved);

  Object.keys(data).forEach(id => {
    const table = document.getElementById(id);
    if (table) {
      table.querySelector('tbody').innerHTML = data[id];
    }
  });
}

function clearAllTablesFromLocalStorage() {
  localStorage.removeItem('vulcan-lives-data');
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