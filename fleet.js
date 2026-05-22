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
function getInvoices() {
  return JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

// ── Bin size from name ──────────────────────────────────
function getBinSize(name) {
  const n = String(name || '');
  if (n.startsWith('20')) return '20-Yard';
  if (n.startsWith('25')) return '25-Yard';
  return 'Other';
}

// ── Status calculation ──────────────────────────────────
function calcBinStatus(bin, invoices) {
  const t = todayStr();

  const candidates = invoices.filter(inv => {
    if (inv.binId !== bin.id) return false;
    if (!inv.rentalDrop)      return false;
    return inv.rentalDrop <= t;
  });
  candidates.sort((a, b) => (b.rentalDrop || '').localeCompare(a.rentalDrop || ''));
  const inv = candidates[0];

  if (!inv) return { status: 'available', inv: null, days: null, daysRented: null };

  const daysRented = diffDays(inv.rentalDrop, t);

  // Pickup date has passed — use invoice payment status to decide
  if (inv.rentalPick && inv.rentalPick < t) {
    // Paid invoice = job complete, bin physically returned
    if (inv.status === 'paid') {
      return { status: 'available', inv: null, days: null, daysRented: null };
    }
    // Unpaid/partial = pickup was missed or invoice not settled → overdue
    const days = diffDays(t, inv.rentalPick); // negative: how many days past due
    return { status: 'overdue', inv, days, daysRented };
  }

  const days = inv.rentalPick ? diffDays(t, inv.rentalPick) : null;

  if (days !== null && days <= 1) return { status: 'pickup-due', inv, days, daysRented };
  return { status: 'rented', inv, days, daysRented };
}

// ── Summary bar ─────────────────────────────────────────
function renderSummary(results) {
  const el = document.getElementById('fleet-summary');
  if (!el) return;

  const sizeOrder = ['20-Yard', '25-Yard', 'Other'];

  // Group results by size
  const groups = {};
  results.forEach(r => {
    const size = getBinSize(r.bin.name);
    if (!groups[size]) groups[size] = [];
    groups[size].push(r);
  });

  // Overall counts
  const totalAvailable  = results.filter(r => r.status === 'available').length;
  const totalOut        = results.filter(r => r.status !== 'available').length;
  const totalPickupDue  = results.filter(r => r.status === 'pickup-due').length;
  const totalOverdue    = results.filter(r => r.status === 'overdue').length;

  let html = `
    <div class="fleet-summary-overall">
      <span class="fso-label">All Bins</span>
      <span><strong>${results.length}</strong> Total</span>
      <span class="fso-avail"><strong>${totalAvailable}</strong> Available</span>
      <span class="fso-out"><strong>${totalOut}</strong> Out</span>
      ${totalPickupDue ? `<span class="fso-pickup"><strong>${totalPickupDue}</strong> Pickup Due</span>` : ''}
      ${totalOverdue   ? `<span class="fso-overdue"><strong>${totalOverdue}</strong> Overdue</span>`    : ''}
    </div>
  `;

  sizeOrder.forEach(size => {
    const group = groups[size];
    if (!group || !group.length) return;
    const avail     = group.filter(r => r.status === 'available').length;
    const out       = group.filter(r => r.status !== 'available').length;
    const pickupDue = group.filter(r => r.status === 'pickup-due').length;
    const overdue   = group.filter(r => r.status === 'overdue').length;

    html += `
      <div class="fleet-summary-section">
        <span class="fss-label">${size}</span>
        <span><strong>${group.length}</strong> total</span>
        <span class="fso-avail"><strong>${avail}</strong> available</span>
        <span class="fso-out"><strong>${out}</strong> out</span>
        ${pickupDue ? `<span class="fso-pickup"><strong>${pickupDue}</strong> pickup due</span>` : ''}
        ${overdue   ? `<span class="fso-overdue"><strong>${overdue}</strong> overdue</span>`    : ''}
      </div>
    `;
  });

  el.innerHTML = html;
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
    renderSummary([]);
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';

  const results = bins.map(bin => ({ bin, ...calcBinStatus(bin, invoices) }));
  renderSummary(results);

  // Group by bin size, in a defined order
  const sizeOrder = ['20-Yard', '25-Yard', 'Other'];
  const groups = {};
  results.forEach(r => {
    const size = getBinSize(r.bin.name);
    if (!groups[size]) groups[size] = [];
    groups[size].push(r);
  });

  tbody.innerHTML = '';

  sizeOrder.forEach(size => {
    const group = groups[size];
    if (!group || !group.length) return;

    // Section header row
    const hdr = document.createElement('tr');
    hdr.className = 'fleet-size-header';
    hdr.innerHTML = `<td colspan="8">${size} Bins</td>`;
    tbody.appendChild(hdr);

    group.forEach(({ bin, status, inv, days, daysRented }) => {
      const tr = document.createElement('tr');
      tr.className = `fleet-row-${status}`;

      const badge = {
        available:    '<span class="fleet-badge fb-available">&#11044; Available</span>',
        rented:       '<span class="fleet-badge fb-rented">&#9711; Rented</span>',
        'pickup-due': '<span class="fleet-badge fb-pickup-due">&#11044; Pickup Due</span>',
        overdue:      '<span class="fleet-badge fb-overdue">&#11044; Overdue</span>',
      }[status] || '';

      const daysUntilDisplay = days === null   ? '—'
        : days < 0   ? `${Math.abs(days)}d overdue`
        : days === 0 ? 'Today'
        : days === 1 ? 'Tomorrow'
        : `${days} days`;

      const daysRentedDisplay = (daysRented !== null && status !== 'available')
        ? `${daysRented} day${daysRented !== 1 ? 's' : ''}`
        : '—';

      tr.innerHTML = `
        <td><strong>${escHtml(bin.name)}</strong></td>
        <td>${badge}</td>
        <td>${inv?.rentalDrop || '—'}</td>
        <td>${inv?.rentalPick || '—'}</td>
        <td>${daysRentedDisplay}</td>
        <td style="font-weight:${days !== null && days <= 1 ? '700' : '400'}">${daysUntilDisplay}</td>
        <td>${escHtml(inv?.client?.name || '—')}</td>
        <td>${escHtml(inv?.id || '—')}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// ── Auto-refresh every 60 seconds ──────────────────────
setInterval(renderFleet, 60000);

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderFleet();
});
