/* =====================================================
   TMT Invoicing — billing-codes.js
   Manage billing codes stored in localStorage
   ===================================================== */

const LS_BILLING_CODES = 'tmt_billing_codes';

const DEFAULT_BILLING_CODES = [
  { id: 'bc1',  name: 'Bin 2001 - 25 yard - 3 day', defaultPrice: 350, rentalDays: 3  },
  { id: 'bc2',  name: 'Bin 2001 - 25 yard - 5 day', defaultPrice: 400, rentalDays: 5  },
  { id: 'bc3',  name: '20-03 - 20 yard - 3 day',    defaultPrice: 400, rentalDays: 3  },
  { id: 'bc4',  name: '20-05 - 20 yard - 5 day',    defaultPrice: 450, rentalDays: 5  },
  { id: 'bc5',  name: '20-07 - 20 yard - 7 day',    defaultPrice: 500, rentalDays: 7  },
  { id: 'bc6',  name: '20-14 - 20 yard - 14 day',   defaultPrice: 600, rentalDays: 14 },
  { id: 'bc7',  name: '25-03 - 25 yard - 3 day',    defaultPrice: 450, rentalDays: 3  },
  { id: 'bc8',  name: '25-05 - 25 yard - 5 day',    defaultPrice: 500, rentalDays: 5  },
  { id: 'bc9',  name: '25-07 - 25 yard - 7 day',    defaultPrice: 550, rentalDays: 7  },
  { id: 'bc10', name: '25-14 - 25 yard - 14 day',   defaultPrice: 650, rentalDays: 14 },
];

// ── Helpers ────────────────────────────────────────────
function getBillingCodes() {
  const stored = localStorage.getItem(LS_BILLING_CODES);
  if (!stored) {
    localStorage.setItem(LS_BILLING_CODES, JSON.stringify(DEFAULT_BILLING_CODES));
    return DEFAULT_BILLING_CODES;
  }
  let codes = JSON.parse(stored);
  // Merge any new default codes not yet in localStorage
  let changed = false;
  DEFAULT_BILLING_CODES.forEach(def => {
    if (!codes.find(c => c.id === def.id)) {
      codes.push(def);
      changed = true;
    }
  });
  if (changed) saveBillingCodes(codes);
  return codes;
}
function saveBillingCodes(codes) {
  localStorage.setItem(LS_BILLING_CODES, JSON.stringify(codes));
}
function genId() {
  return 'bc' + Date.now();
}
function fmtMoney(n) {
  return '$' + parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showAlert(msg, type = 'success') {
  const el = document.getElementById('alert-box');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Render codes table ─────────────────────────────────
function renderCodes() {
  const codes  = getBillingCodes();
  const tbody  = document.getElementById('codes-body');
  const empty  = document.getElementById('codes-empty');
  const table  = document.getElementById('codes-table');

  tbody.innerHTML = '';

  if (codes.length === 0) {
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';

  codes.forEach((code, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(code.name)}</td>
      <td>${fmtMoney(code.defaultPrice)}</td>
      <td>${code.rentalDays ? code.rentalDays + ' day' + (code.rentalDays !== 1 ? 's' : '') : '—'}</td>
      <td class="no-click" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="startEdit('${escHtml(code.id)}')">Edit</button>
        <button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="deleteCode('${escHtml(code.id)}')">Delete</button>
        ${idx > 0 ? `<button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="moveCode('${escHtml(code.id)}', -1)" title="Move up">&#8593;</button>` : ''}
        ${idx < codes.length-1 ? `<button class="btn btn-ghost btn-sm" onclick="moveCode('${escHtml(code.id)}', 1)" title="Move down">&#8595;</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Save (add or update) ───────────────────────────────
function saveCode() {
  const name   = document.getElementById('code-name').value.trim();
  const price  = parseFloat(document.getElementById('code-price').value);
  const days   = parseInt(document.getElementById('code-days').value) || 0;
  const editId = document.getElementById('edit-id').value;

  if (!name)         { showAlert('Please enter a billing code name.', 'error'); return; }
  if (isNaN(price))  { showAlert('Please enter a valid price.', 'error'); return; }

  const codes = getBillingCodes();

  if (editId) {
    // Update existing
    const idx = codes.findIndex(c => c.id === editId);
    if (idx >= 0) {
      codes[idx].name         = name;
      codes[idx].defaultPrice = price;
      codes[idx].rentalDays   = days;
    }
    showAlert('Billing code updated!');
  } else {
    // Add new
    codes.push({ id: genId(), name, defaultPrice: price, rentalDays: days });
    showAlert('Billing code added!');
  }

  saveBillingCodes(codes);
  resetForm();
  renderCodes();
}

// ── Edit ───────────────────────────────────────────────
function startEdit(id) {
  const code = getBillingCodes().find(c => c.id === id);
  if (!code) return;
  document.getElementById('edit-id').value    = id;
  document.getElementById('code-name').value  = code.name;
  document.getElementById('code-price').value = code.defaultPrice;
  document.getElementById('code-days').value  = code.rentalDays || '';
  document.getElementById('form-title').textContent = 'Edit Billing Code';
  document.getElementById('btn-cancel-edit').style.display = '';
  document.getElementById('code-name').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.startEdit = startEdit;

// ── Delete ─────────────────────────────────────────────
function deleteCode(id) {
  if (!confirm('Delete this billing code?')) return;
  saveBillingCodes(getBillingCodes().filter(c => c.id !== id));
  renderCodes();
  showAlert('Billing code deleted.');
}
window.deleteCode = deleteCode;

// ── Reorder ────────────────────────────────────────────
function moveCode(id, direction) {
  const codes = getBillingCodes();
  const idx   = codes.findIndex(c => c.id === id);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= codes.length) return;
  [codes[idx], codes[newIdx]] = [codes[newIdx], codes[idx]];
  saveBillingCodes(codes);
  renderCodes();
}
window.moveCode = moveCode;

// ── Reset form ─────────────────────────────────────────
function resetForm() {
  document.getElementById('edit-id').value    = '';
  document.getElementById('code-name').value  = '';
  document.getElementById('code-price').value = '';
  document.getElementById('code-days').value  = '';
  document.getElementById('form-title').textContent = 'Add Billing Code';
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCodes();
  document.getElementById('btn-save-code').addEventListener('click', saveCode);
  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    resetForm();
  });
  // Allow Enter key to save
  ['code-name','code-price','code-days'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveCode();
    });
  });
});
