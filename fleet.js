/* =====================================================
   TMT Invoicing — fleet.js
   Bin fleet status, computed from open invoices
   ===================================================== */

const LS_BINS     = 'tmt_bins';
const LS_INVOICES = 'tmt_invoices';

const DEFAULT_BINS = [
  { id: 'bin-2001', name: '2001' },
  { id: 'bin-2002', name: '2002' },
  { id: 'bin-2501', name: '2501' },
  { id: 'bin-2502', name: '2502' },
  { id: 'bin-2503', name: '2503' },
];

// ── Storage helpers ─────────────────────────────────────
function getBins() {
  const stored = localStorage.getItem(LS_BINS);
  if (!stored) {
    localStorage.setItem(LS_BINS, JSON.stringify(DEFAULT_BINS));
    return DEFAULT_BINS;
  }
  return JSON.parse(stored);
}
function saveBins(bins) {
  localStorage.setItem(LS_BINS, JSON.stringify(bins));
}
function getInvoices() {
  return JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
}
function genBinId() { return 'bin-' + Date.now(); }

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showAlert(msg, type = 'success') {
  const el = document.getElementById('alert-box');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function diffDays(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const s = new Date(startStr + 'T12:00:00');
  const e = new Date(endStr   + 'T12:00:00');
  return Math.round((e - s) / 86400000);
}

// ── Status calculation ──────────────────────────────────
function calcBinStatus(bin, invoices) {
  const t = todayStr();

  // Find the most relevant active invoice for this bin
  // Active = drop-off has happened AND pickup hasn't passed yet (or no pickup set)
  const candidates = invoices.filter(inv => {
    if (inv.binId !== bin.id) return false;
    if (!inv.rentalDrop)      return false;
    return inv.rentalDrop <= t; // drop-off date has arrived
  });

  // Sort by drop-off descending to get the most recent
  candidates.sort((a, b) => (b.rentalDrop || '').localeCompare(a.rentalDrop || ''));
  const inv = candidates[0];

  if (!inv) return { status: 'available' };

  // If pickup date is in the past, bin has been returned → available
  if (inv.rentalPick && inv.rentalPick < t) return { status: 'available' };

  const days = inv.rentalPick ? diffDays(t, inv.rentalPick) : null;

  if (days !== null && days < 0)  return { status: 'overdue',    inv, days };
  if (days !== null && days <= 1) return { status: 'pickup-due', inv, days };
  return { status: 'rented', inv, days };
}

// ── Render fleet table ──────────────────────────────────
function renderFleet() {
  const bins     = getBins();
  const invoices = getInvoices();
  const tbody    = document.getElementById('fleet-body');
  const empty    = document.getElementById('fleet-empty');
  const table    = document.getElementById('fleet-table');

  if (!bins.length) {
    empty.style.display = 'block';
    table.style.display = 'none';
    renderSummary([], []);
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';

  const results = bins.map(bin => ({ bin, ...calcBinStatus(bin, invoices) }));
  renderSummary(results, bins);

  tbody.innerHTML = '';
  results.forEach(({ bin, status, inv, days }) => {
    const tr = document.createElement('tr');
    tr.className = `fleet-row-${status}`;

    const badge = {
      available:  '<span class="fleet-badge fb-available">&#11044; Available</span>',
      rented:     '<span class="fleet-badge fb-rented">&#9711; Rented</span>',
      'pickup-due': '<span class="fleet-badge fb-pickup-due">&#11044; Pickup Due</span>',
      overdue:    '<span class="fleet-badge fb-overdue">&#11044; Overdue</span>',
    }[status] || '';

    const daysDisplay = days === null   ? '—'
      : days < 0   ? `${Math.abs(days)}d overdue`
      : days === 0 ? 'Today'
      : days === 1 ? 'Tomorrow'
      : `${days} days`;

    tr.innerHTML = `
      <td><strong>${escHtml(bin.name)}</strong></td>
      <td>${badge}</td>
      <td>${inv?.rentalDrop || '—'}</td>
      <td>${inv?.rentalPick || '—'}</td>
      <td style="font-weight:${days !== null && days <= 1 ? '700' : '400'}">${daysDisplay}</td>
      <td>${escHtml(inv?.client?.name || '—')}</td>
      <td>${escHtml(inv?.id || '—')}</td>
      <td class="no-click no-print" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="startEditBin('${escHtml(bin.id)}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBin('${escHtml(bin.id)}')" style="margin-left:6px">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Summary bar ─────────────────────────────────────────
function renderSummary(results, bins) {
  const el = document.getElementById('fleet-summary');
  if (!el) return;
  const available  = results.filter(r => r.status === 'available').length;
  const rented     = results.filter(r => r.status === 'rented').length;
  const pickupDue  = results.filter(r => r.status === 'pickup-due').length;
  const overdue    = results.filter(r => r.status === 'overdue').length;

  el.innerHTML = `
    <span><strong>${bins.length}</strong> Total Bins</span>
    <span style="color:var(--success)"><strong>${available}</strong> Available</span>
    <span style="color:#6c7a89"><strong>${rented}</strong> Rented</span>
    ${pickupDue ? `<span style="color:#e67e00"><strong>${pickupDue}</strong> Pickup Due</span>` : ''}
    ${overdue   ? `<span style="color:var(--danger)"><strong>${overdue}</strong> Overdue</span>`  : ''}
  `;
}

// ── Add / Edit bin ──────────────────────────────────────
function saveBin() {
  const name   = document.getElementById('bin-name').value.trim();
  const editId = document.getElementById('bin-edit-id').value;
  if (!name) { showAlert('Please enter a bin ID.', 'error'); return; }

  const bins = getBins();

  if (editId) {
    const idx = bins.findIndex(b => b.id === editId);
    if (idx >= 0) bins[idx].name = name;
    showAlert(`Bin ${name} updated.`);
  } else {
    if (bins.find(b => b.name === name)) { showAlert('A bin with that ID already exists.', 'error'); return; }
    bins.push({ id: genBinId(), name });
    showAlert(`Bin ${name} added.`);
  }
  saveBins(bins);
  resetBinForm();
  renderFleet();
}

function startEditBin(id) {
  const bin = getBins().find(b => b.id === id);
  if (!bin) return;
  document.getElementById('bin-edit-id').value = id;
  document.getElementById('bin-name').value    = bin.name;
  document.getElementById('bin-form-title').textContent = 'Edit Bin';
  document.getElementById('btn-cancel-bin').style.display = '';
  document.getElementById('bin-name').focus();
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
window.startEditBin = startEditBin;

function deleteBin(id) {
  const bin = getBins().find(b => b.id === id);
  if (!confirm(`Remove bin ${bin?.name || id}? This will not delete any invoices.`)) return;
  saveBins(getBins().filter(b => b.id !== id));
  renderFleet();
  showAlert('Bin removed.');
}
window.deleteBin = deleteBin;

function resetBinForm() {
  document.getElementById('bin-edit-id').value = '';
  document.getElementById('bin-name').value    = '';
  document.getElementById('bin-form-title').textContent = 'Add Bin';
  document.getElementById('btn-cancel-bin').style.display = 'none';
}

// ── Auto-refresh every 60 seconds ──────────────────────
setInterval(renderFleet, 60000);

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderFleet();
  document.getElementById('btn-save-bin').addEventListener('click', saveBin);
  document.getElementById('btn-cancel-bin').addEventListener('click', resetBinForm);
  document.getElementById('bin-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBin();
  });
});
