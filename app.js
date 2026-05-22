/* =====================================================
   TMT Invoicing — app.js
   Invoice form logic, PDF export, localStorage save
   ===================================================== */

// ── Configuration — fill in your details ──────────────
const TMT_CONFIG = {
  companyName:    'TMT Waste Solutions',
  phone:          '',
  email:          '',
  address:        '',
  defaultTaxRate: 8.25,
  paymentLink:    '',
  paymentLabel:   'Pay Online',
};

// ── localStorage keys ──────────────────────────────────
const LS_INVOICES      = 'tmt_invoices';
const LS_NEXT_NUM      = 'tmt_next_invoice_num';
const LS_BILLING_CODES = 'tmt_billing_codes';
const LS_BINS          = 'tmt_bins';

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
function getInvoices() {
  return JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
}
function saveInvoices(arr) {
  localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
}
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
  if (changed) localStorage.setItem(LS_BILLING_CODES, JSON.stringify(codes));
  return codes;
}
const DEFAULT_BINS = [
  { id: 'bin-2001', name: '2001' },
  { id: 'bin-2002', name: '2002' },
  { id: 'bin-2501', name: '2501' },
  { id: 'bin-2502', name: '2502' },
  { id: 'bin-2503', name: '2503' },
];
function getBins() {
  const stored = localStorage.getItem(LS_BINS);
  if (!stored) { localStorage.setItem(LS_BINS, JSON.stringify(DEFAULT_BINS)); return DEFAULT_BINS; }
  return JSON.parse(stored);
}
function getBinName(id) {
  if (!id) return '';
  const bin = getBins().find(b => b.id === id);
  return bin ? bin.name : id;
}
function populateBinSelect() {
  const sel = document.getElementById('bin-select');
  if (!sel) return;
  const bins = getBins();
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select Bin --</option>' +
    bins.map(b => `<option value="${escHtml(b.id)}"${b.id === current ? ' selected' : ''}>${escHtml(b.name)}</option>`).join('');
}

function getNextNum() {
  return parseInt(localStorage.getItem(LS_NEXT_NUM) || '1', 10);
}
function bumpNextNum() {
  localStorage.setItem(LS_NEXT_NUM, String(getNextNum() + 1));
}
function fmtMoney(n) {
  return '$' + parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00'); // noon avoids DST boundary shifts
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function diffDays(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const s = new Date(startStr + 'T12:00:00');
  const e = new Date(endStr   + 'T12:00:00');
  return Math.round((e - s) / 86400000);
}

// ── Rental date auto-calculation ───────────────────────
function calcRentalDates(source) {
  const dropEl = document.getElementById('rental-drop');
  const pickEl = document.getElementById('rental-pick');
  const durEl  = document.getElementById('rental-duration');
  if (!dropEl || !pickEl || !durEl) return;

  const drop = dropEl.value;
  const pick = pickEl.value;
  const dur  = parseInt(durEl.value) || 0;

  if (source === 'drop') {
    if (drop && dur > 0)   pickEl.value = addDays(drop, dur);   // drop + dur → pick
    else if (drop && pick) { const d = diffDays(drop, pick); if (d >= 0) durEl.value = d; } // drop + pick → dur
  } else if (source === 'pick') {
    if (drop && pick)      { const d = diffDays(drop, pick); if (d >= 0) durEl.value = d; } // drop + pick → dur
    else if (pick && dur)  dropEl.value = addDays(pick, -dur);  // pick + dur → drop
  } else if (source === 'dur') {
    if (drop && dur > 0)   pickEl.value = addDays(drop, dur);   // drop + dur → pick
    else if (pick && dur)  dropEl.value = addDays(pick, -dur);  // pick + dur → drop
  }
}
window.calcRentalDates = calcRentalDates;
function termsToOffset(terms) {
  const map = { 'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 60': 60 };
  return map[terms] ?? 0;
}
function showAlert(msg, type = 'success') {
  const el = document.getElementById('alert-box');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Line-item row builder ──────────────────────────────
let rowCount = 0;

function buildRow(item = {}) {
  const codes     = getBillingCodes();
  const savedCode = item.billingCodeId || '';
  const desc      = item.description   || '';
  const qty       = item.qty           ?? 1;
  const rate      = item.rate          ?? 0;
  const lineTotal = item.total         ?? 0;

  const blankSel  = !savedCode ? 'selected' : '';
  const options   = codes.map(c =>
    `<option value="${escHtml(c.id)}" data-price="${c.defaultPrice}" ${c.id===savedCode?'selected':''}>${escHtml(c.name)}</option>`
  ).join('');

  const tr = document.createElement('tr');
  tr.dataset.rowId = ++rowCount;
  tr.innerHTML = `
    <td class="col-type" data-label="Billing Code">
      <select data-role="type" onchange="onBillingCodeChange(this)">
        <option value="" ${blankSel}>-- Select --</option>${options}
      </select>
    </td>
    <td class="col-desc" data-label="Description">
      <input type="text" data-role="desc" value="${escHtml(desc)}" placeholder="Description" oninput="recalcRow(this)" autocomplete="off">
    </td>
    <td class="col-qty" data-label="Qty">
      <input type="number" data-role="qty" value="${qty}" min="0" step="any" inputmode="decimal" oninput="recalcRow(this)">
    </td>
    <td class="col-rate" data-label="Rate ($)">
      <input type="number" data-role="rate" value="${rate}" min="0" step="0.01" placeholder="0.00" inputmode="decimal" oninput="recalcRow(this)">
    </td>
    <td class="col-total" data-label="Amount" data-role="total">${fmtMoney(lineTotal)}</td>
    <td class="col-del"><button class="del-row-btn" title="Remove" onclick="removeRow(this)">×</button></td>
  `;
  return tr;
}

function onBillingCodeChange(sel) {
  const row    = sel.closest('tr');
  const descEl = row.querySelector('[data-role="desc"]');
  const rateEl = row.querySelector('[data-role="rate"]');
  if (!sel.value) return;
  const code = getBillingCodes().find(c => c.id === sel.value);
  if (!code) return;
  descEl.value = code.name;
  rateEl.value = code.defaultPrice;
  recalcRow(rateEl);
  // Auto-fill rental duration from billing code
  if (code.rentalDays > 0) {
    const durEl = document.getElementById('rental-duration');
    if (durEl) { durEl.value = code.rentalDays; calcRentalDates('dur'); }
  }
}

function recalcRow(input) {
  const row  = input.closest('tr');
  const qty  = parseFloat(row.querySelector('[data-role="qty"]').value)  || 0;
  const rate = parseFloat(row.querySelector('[data-role="rate"]').value) || 0;
  row.querySelector('[data-role="total"]').textContent = fmtMoney(qty * rate);
  recalcTotals();
}

function removeRow(btn) {
  btn.closest('tr').remove();
  recalcTotals();
}

window.onBillingCodeChange = onBillingCodeChange;
window.recalcRow           = recalcRow;
window.removeRow           = removeRow;

// ── Totals ─────────────────────────────────────────────
function recalcTotals() {
  const rows = document.querySelectorAll('#line-items-body tr');
  let subtotal = 0;

  rows.forEach(row => {
    const qty  = parseFloat(row.querySelector('[data-role="qty"]')?.value)  || 0;
    const rate = parseFloat(row.querySelector('[data-role="rate"]')?.value) || 0;
    subtotal += qty * rate;
  });

  const taxRate = parseFloat(document.getElementById('tax-rate')?.value) || 0;
  const taxAmt  = subtotal * taxRate / 100;
  const total   = subtotal + taxAmt;
  const paidAmt = parseFloat(document.getElementById('paid-amount')?.value) || 0;
  const balance = total - paidAmt;

  document.getElementById('subtotal-display').textContent = fmtMoney(subtotal);
  document.getElementById('tax-amt-display').textContent  = fmtMoney(taxAmt);
  document.getElementById('total-display').textContent    = fmtMoney(total);
  document.getElementById('balance-display').textContent  = fmtMoney(balance);
}

// ── Due-date auto-calc ─────────────────────────────────
function updateDueDate() {
  const invDate = document.getElementById('inv-date')?.value || today();
  const terms   = document.getElementById('inv-terms')?.value || 'Due on Receipt';
  const dueEl   = document.getElementById('inv-due');
  if (dueEl && !dueEl.dataset.manuallySet) {
    dueEl.value = addDays(invDate, termsToOffset(terms));
  }
}

// ── Add row ────────────────────────────────────────────
function addRow(item) {
  document.getElementById('line-items-body').appendChild(buildRow(item));
  recalcTotals();
}
window.addRow = addRow;

// ── Gather form data ───────────────────────────────────
function collectInvoice() {
  const rows = [...document.querySelectorAll('#line-items-body tr')];
  const lineItems = rows.map(row => {
    const qty  = parseFloat(row.querySelector('[data-role="qty"]').value)  || 0;
    const rate = parseFloat(row.querySelector('[data-role="rate"]').value) || 0;
    return {
      billingCodeId: row.querySelector('[data-role="type"]').value,
      description:   row.querySelector('[data-role="desc"]').value,
      qty, rate,
      total: qty * rate,
    };
  });

  const taxRate  = parseFloat(document.getElementById('tax-rate').value) || 0;
  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const taxAmt   = subtotal * taxRate / 100;
  const total    = subtotal + taxAmt;
  const paidAmt  = parseFloat(document.getElementById('paid-amount').value) || 0;

  return {
    id:          document.getElementById('inv-number').value.trim(),
    date:        document.getElementById('inv-date').value,
    dueDate:     document.getElementById('inv-due').value,
    terms:       document.getElementById('inv-terms').value,
    version:     parseInt(document.getElementById('inv-version').value || '1', 10),
    client: {
      name:    document.getElementById('client-name').value.trim(),
      address: document.getElementById('client-address').value.trim(),
      email:   document.getElementById('client-email').value.trim(),
      phone:   document.getElementById('client-phone').value.trim(),
    },
    lineItems,
    subtotal,
    taxRate,
    taxAmount:  taxAmt,
    total,
    paidAmount: paidAmt,
    balanceDue: total - paidAmt,
    binId:       document.getElementById('bin-select')?.value || '',
    binName:     getBinName(document.getElementById('bin-select')?.value || ''),
    rentalDrop:  document.getElementById('rental-drop').value,
    rentalPick:  document.getElementById('rental-pick').value,
    rentalDays:  parseInt(document.getElementById('rental-duration').value) || 0,
    paymentLink: document.getElementById('payment-link-input').value.trim(),
    notes:       document.getElementById('notes').value.trim(),
    status:      computeStatus(total, paidAmt),
    createdAt:   document.getElementById('inv-created-at').value || new Date().toISOString(),
  };
}

// ── Compute invoice status ─────────────────────────────
function computeStatus(total, paid) {
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

// ── Save invoice ────────────────────────────────────────
function saveInvoice() {
  const inv = collectInvoice();
  if (!inv.client.name) { showAlert('Please enter a client name.', 'error'); return; }
  if (!inv.id)          { showAlert('Please enter an invoice number.', 'error'); return; }

  const list     = getInvoices();
  const existing = list.findIndex(i => i.id === inv.id);

  if (existing >= 0) {
    // Increment version on update
    inv.version = (list[existing].version || 1) + 1;
    list[existing] = inv;
    showAlert(`Invoice ${inv.id} updated — now v${inv.version}.`);
  } else {
    inv.version = 1;
    list.push(inv);
    bumpNextNum();
    showAlert(`Invoice ${inv.id} saved!`);
  }

  document.getElementById('inv-version').value = inv.version;
  updateVersionBadge(inv.version);
  saveInvoices(list);
}

// ── Load existing invoice into form (edit mode) ────────
function loadInvoiceForEdit(inv) {
  document.getElementById('inv-number').value    = inv.id;
  document.getElementById('inv-date').value      = inv.date;
  document.getElementById('inv-terms').value     = inv.terms || 'Due on Receipt';
  document.getElementById('inv-version').value   = inv.version || 1;
  document.getElementById('inv-created-at').value = inv.createdAt || '';
  updateVersionBadge(inv.version || 1);

  const dueEl = document.getElementById('inv-due');
  dueEl.value = inv.dueDate || '';
  dueEl.dataset.manuallySet = 'true';

  document.getElementById('client-name').value    = inv.client?.name    || '';
  document.getElementById('client-phone').value   = inv.client?.phone   || '';
  document.getElementById('client-email').value   = inv.client?.email   || '';
  document.getElementById('client-address').value = inv.client?.address || '';
  document.getElementById('notes').value          = inv.notes           || '';
  document.getElementById('payment-link-input').value = inv.paymentLink || '';
  document.getElementById('tax-rate').value       = inv.taxRate         ?? TMT_CONFIG.defaultTaxRate;

  document.getElementById('rental-drop').value      = inv.rentalDrop || '';
  document.getElementById('rental-pick').value      = inv.rentalPick || '';
  document.getElementById('rental-duration').value  = inv.rentalDays  || '';
  document.getElementById('paid-amount').value      = inv.paidAmount  || 0;
  const binSelEdit = document.getElementById('bin-select');
  if (binSelEdit) binSelEdit.value = inv.binId || '';

  document.getElementById('line-items-body').innerHTML = '';
  rowCount = 0;
  (inv.lineItems || []).forEach(li => addRow(li));
  recalcTotals();

  // Banner to signal edit mode
  showAlert(`Editing Invoice ${inv.id} — save to create v${(inv.version || 1) + 1}.`, 'success');
}

function updateVersionBadge(v) {
  const badge = document.getElementById('version-badge');
  if (!badge) return;
  badge.textContent = `v${v}`;
  badge.style.display = 'inline-block';
}

// ── Invoice preview renderer (PDF + modal) ────────────
function renderPreview(inv) {
  const cfg     = TMT_CONFIG;
  const contact = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join('  ·  ');
  const paid    = parseFloat(inv.paidAmount) || 0;
  const balance = parseFloat(inv.balanceDue) ?? (inv.total - paid);

  const clientSub = [
    inv.client?.address ? escHtml(inv.client.address).replace(/\n/g, '<br>') : '',
    inv.client?.email   ? escHtml(inv.client.email)  : '',
    inv.client?.phone   ? escHtml(inv.client.phone)  : '',
  ].filter(Boolean).join('<br>');

  const itemRows = (inv.lineItems || []).map(it => `
    <tr>
      <td>${escHtml(it.description)}</td>
      <td style="text-align:center;width:48px">${it.qty}</td>
      <td style="text-align:right;width:88px">${fmtMoney(it.rate)}</td>
      <td style="text-align:right;width:96px;font-weight:600">${fmtMoney(it.total)}</td>
    </tr>`).join('');

  const paymentBlock = inv.paymentLink
    ? `<div class="inv-payment-box">
         <strong>Pay Online:</strong>
         <a href="${escHtml(inv.paymentLink)}" target="_blank">${escHtml(inv.paymentLink)}</a>
       </div>`
    : '';

  const notesBlock = inv.notes
    ? `<div class="inv-notes-box"><strong>Notes:</strong> ${escHtml(inv.notes)}</div>`
    : '';

  const hasFooter = inv.paymentLink || inv.notes;

  return `
    <div class="inv-header-band">
      <div>
        <div class="inv-company-name">${escHtml(cfg.companyName)}</div>
        ${contact ? `<div class="inv-company-contact">${escHtml(contact)}</div>` : ''}
      </div>
      <div class="inv-header-right">
        <div class="inv-word-invoice">Invoice</div>
        <div class="inv-number-display">${escHtml(inv.id)}</div>
        <div class="inv-version-display">Version ${inv.version || 1}</div>
      </div>
    </div>

    <div class="inv-info-strip">
      <div class="inv-bill-to">
        <div class="inv-section-label">Bill To</div>
        <div class="inv-client-name-lg">${escHtml(inv.client?.name || '—')}</div>
        ${clientSub ? `<div class="inv-client-sub">${clientSub}</div>` : ''}
      </div>
      <div class="inv-details-block">
        <div class="inv-section-label">Invoice Details</div>
        <table class="inv-details-table">
          <tr><td>Date</td><td>${inv.date || ''}</td></tr>
          <tr><td>Due Date</td><td>${inv.dueDate || ''}</td></tr>
          <tr><td>Terms</td><td>${escHtml(inv.terms || '')}</td></tr>
        </table>
      </div>
    </div>

    ${(inv.binId || inv.rentalDrop || inv.rentalPick || inv.rentalDays) ? `
    <div class="inv-rental-strip">
      <div class="inv-section-label">Rental Details</div>
      <div class="inv-rental-row">
        ${inv.binId    ? `<div class="inv-rental-item"><span>Bin #</span>${escHtml(inv.binName || inv.binId)}</div>` : ''}
        ${inv.rentalDrop ? `<div class="inv-rental-item"><span>Drop Off</span>${inv.rentalDrop}</div>` : ''}
        ${inv.rentalPick ? `<div class="inv-rental-item"><span>Pickup</span>${inv.rentalPick}</div>` : ''}
        ${inv.rentalDays ? `<div class="inv-rental-item"><span>Duration</span>${inv.rentalDays} day${inv.rentalDays != 1 ? 's' : ''}</div>` : ''}
      </div>
    </div>` : ''}

    <div class="inv-services-wrap">
      <div class="inv-section-label">Services</div>
      <table class="inv-services-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:center;width:48px">Qty</th>
            <th style="text-align:right;width:88px">Rate</th>
            <th style="text-align:right;width:96px">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="inv-totals-wrap">
      <table class="inv-totals-table">
        <tr><td>Subtotal</td><td>${fmtMoney(inv.subtotal)}</td></tr>
        <tr><td>Tax (${inv.taxRate}%)</td><td>${fmtMoney(inv.taxAmount)}</td></tr>
        <tr class="inv-tr-divider inv-tr-grand"><td>Total</td><td>${fmtMoney(inv.total)}</td></tr>
        <tr><td style="padding-top:8px">Amount Paid</td><td style="padding-top:8px">${fmtMoney(paid)}</td></tr>
        <tr class="inv-tr-balance"><td>Balance Due</td><td>${fmtMoney(balance)}</td></tr>
      </table>
    </div>

    ${hasFooter ? `<div class="inv-footer-section">${paymentBlock}${notesBlock}</div>` : ''}
    <div class="inv-thankyou">Thank you for your business!</div>
  `;
}

// ── Export PDF ──────────────────────────────────────────
async function exportPDF() {
  const inv       = collectInvoice();
  const previewEl = document.getElementById('invoice-preview');
  previewEl.innerHTML = renderPreview(inv);
  previewEl.style.visibility = 'visible';
  await new Promise(r => setTimeout(r, 100));
  try {
    const canvas  = await html2canvas(previewEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH  = pageW / (canvas.width / canvas.height);
    const pages = Math.ceil(imgH / pageH);
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -i * pageH, pageW, imgH);
    }
    pdf.save(`TMT-Invoice-${inv.id}.pdf`);
  } catch (err) {
    showAlert('PDF export failed. Try printing from the browser.', 'error');
    console.error(err);
  } finally {
    previewEl.style.visibility = 'hidden';
  }
}

// ── New invoice (reset form) ────────────────────────────
function newInvoice() {
  const nextNum = String(getNextNum()).padStart(3, '0');
  document.getElementById('inv-number').value     = 'INV-' + nextNum;
  document.getElementById('inv-date').value       = today();
  document.getElementById('inv-terms').value      = 'Due on Receipt';
  document.getElementById('inv-version').value    = '1';
  document.getElementById('inv-created-at').value = '';
  updateVersionBadge(1);

  const dueEl = document.getElementById('inv-due');
  dueEl.removeAttribute('data-manually-set');
  updateDueDate();

  ['client-name','client-address','client-email','client-phone','notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('payment-link-input').value = TMT_CONFIG.paymentLink;
  document.getElementById('tax-rate').value            = TMT_CONFIG.defaultTaxRate;
  document.getElementById('paid-amount').value         = 0;
  document.getElementById('rental-drop').value         = '';
  document.getElementById('rental-pick').value         = '';
  document.getElementById('rental-duration').value     = '';
  const binSelNew = document.getElementById('bin-select');
  if (binSelNew) binSelNew.value = '';

  document.getElementById('line-items-body').innerHTML = '';
  rowCount = 0;
  addRow({});
  recalcTotals();
  document.getElementById('alert-box').style.display = 'none';

  // Clear edit param from URL without reloading
  const url = new URL(window.location);
  url.searchParams.delete('edit');
  window.history.replaceState({}, '', url);
}

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateBinSelect();
  document.getElementById('tax-rate')?.addEventListener('input', recalcTotals);
  document.getElementById('paid-amount')?.addEventListener('input', recalcTotals);
  document.getElementById('rental-drop')?.addEventListener('change', () => calcRentalDates('drop'));
  document.getElementById('rental-pick')?.addEventListener('change', () => calcRentalDates('pick'));
  document.getElementById('rental-duration')?.addEventListener('input', () => calcRentalDates('dur'));
  document.getElementById('inv-date')?.addEventListener('change', updateDueDate);
  document.getElementById('inv-terms')?.addEventListener('change', updateDueDate);
  document.getElementById('inv-due')?.addEventListener('input', function() {
    this.dataset.manuallySet = 'true';
  });

  document.getElementById('btn-add-row')?.addEventListener('click', () => addRow({}));
  document.getElementById('btn-save')?.addEventListener('click', saveInvoice);
  document.getElementById('btn-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-new')?.addEventListener('click', () => {
    if (confirm('Start a new invoice? Unsaved changes will be lost.')) newInvoice();
  });

  const cfg          = TMT_CONFIG;
  const companyLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join(' · ');
  const subEl        = document.getElementById('company-sub');
  if (subEl) subEl.textContent = companyLines;

  // Check for edit mode
  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) {
    const inv = getInvoices().find(i => i.id === editId);
    if (inv) {
      loadInvoiceForEdit(inv);
      return;
    }
  }
  newInvoice();
});
