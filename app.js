/* =====================================================
   TMT Invoicing — app.js
   Invoice form logic, PDF export, localStorage save
   ===================================================== */

// ── Configuration — fill in your details ──────────────
const TMT_CONFIG = {
  companyName:   'TMT Waste Solutions',
  phone:         '',       // e.g. '(555) 123-4567'
  email:         '',       // e.g. 'billing@tmtrolloff.com'
  address:       '',       // e.g. '123 Main St, Springfield, IL 62701'
  defaultTaxRate: 0,       // e.g. 8.5 for 8.5%
  paymentLink:   '',       // e.g. 'https://venmo.com/u/tmtrolloff'
  paymentLabel:  'Pay Online',
};

// ── localStorage keys ──────────────────────────────────
const LS_INVOICES = 'tmt_invoices';
const LS_NEXT_NUM = 'tmt_next_invoice_num';

// ── Helpers ────────────────────────────────────────────
function getInvoices() {
  return JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
}

function saveInvoices(arr) {
  localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
}

function getNextNum() {
  return parseInt(localStorage.getItem(LS_NEXT_NUM) || '1', 10);
}

function bumpNextNum() {
  const n = getNextNum() + 1;
  localStorage.setItem(LS_NEXT_NUM, String(n));
}

function fmtMoney(n) {
  return '$' + parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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

// ── Line-item row builder ──────────────────────────────
let rowCount = 0;

function buildRow(item = {}) {
  rowCount++;
  const id = rowCount;
  const type       = item.type        || 'rental';
  const desc       = item.description || '';
  const qty        = item.qty         ?? 1;
  const rate       = item.rate        ?? 0;
  const lineTotal  = item.total       ?? 0;

  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td class="col-type" data-label="Type">
      <select data-role="type" onchange="onTypeChange(this)">
        <option value="rental"   ${type==='rental'   ?'selected':''}>Dumpster Rental</option>
        <option value="delivery" ${type==='delivery' ?'selected':''}>Delivery / Pickup</option>
        <option value="overage"  ${type==='overage'  ?'selected':''}>Overage / Weight</option>
        <option value="extended" ${type==='extended' ?'selected':''}>Extended Rental</option>
        <option value="custom"   ${type==='custom'   ?'selected':''}>Custom</option>
      </select>
    </td>
    <td class="col-desc" data-label="Description"><input type="text" data-role="desc" value="${escHtml(desc)}" placeholder="Description" oninput="recalcRow(this)" autocomplete="off"></td>
    <td class="col-qty" data-label="Qty"><input type="number" data-role="qty" value="${qty}" min="0" step="any" inputmode="decimal" oninput="recalcRow(this)"></td>
    <td class="col-rate" data-label="Rate ($)"><input type="number" data-role="rate" value="${rate}" min="0" step="0.01" placeholder="0.00" inputmode="decimal" oninput="recalcRow(this)"></td>
    <td class="col-total" data-label="Amount" data-role="total">${fmtMoney(lineTotal)}</td>
    <td class="col-del"><button class="del-row-btn" title="Remove" onclick="removeRow(this)">×</button></td>
  `;
  return tr;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function onTypeChange(sel) {
  const row  = sel.closest('tr');
  const desc = row.querySelector('[data-role="desc"]');
  const defaults = {
    rental:   'Dumpster rental',
    delivery: 'Delivery / pickup fee',
    overage:  'Overage / weight fee',
    extended: 'Extended rental fee',
    custom:   '',
  };
  if (!desc.value || Object.values(defaults).includes(desc.value)) {
    desc.value = defaults[sel.value] || '';
  }
}

function recalcRow(input) {
  const row   = input.closest('tr');
  const qty   = parseFloat(row.querySelector('[data-role="qty"]').value)  || 0;
  const rate  = parseFloat(row.querySelector('[data-role="rate"]').value) || 0;
  const total = qty * rate;
  row.querySelector('[data-role="total"]').textContent = fmtMoney(total);
  recalcTotals();
}

function removeRow(btn) {
  btn.closest('tr').remove();
  recalcTotals();
}

window.onTypeChange = onTypeChange;
window.recalcRow    = recalcRow;
window.removeRow    = removeRow;

// ── Totals ─────────────────────────────────────────────
function recalcTotals() {
  const rows = document.querySelectorAll('#line-items-body tr');
  let subtotal = 0;
  rows.forEach(row => {
    const qty  = parseFloat(row.querySelector('[data-role="qty"]')?.value)  || 0;
    const rate = parseFloat(row.querySelector('[data-role="rate"]')?.value) || 0;
    subtotal += qty * rate;
  });
  const taxRate   = parseFloat(document.getElementById('tax-rate')?.value) || 0;
  const taxAmt    = subtotal * taxRate / 100;
  const total     = subtotal + taxAmt;

  document.getElementById('subtotal-display').textContent  = fmtMoney(subtotal);
  document.getElementById('tax-amt-display').textContent   = fmtMoney(taxAmt);
  document.getElementById('total-display').textContent     = fmtMoney(total);
}

// ── Due-date auto-calc ─────────────────────────────────
function updateDueDate() {
  const invDate = document.getElementById('inv-date')?.value || today();
  const terms   = document.getElementById('inv-terms')?.value || 'Due on Receipt';
  const offset  = termsToOffset(terms);
  const dueEl   = document.getElementById('inv-due');
  if (dueEl && !dueEl.dataset.manuallySet) {
    dueEl.value = addDays(invDate, offset);
  }
}

// ── Add row button ─────────────────────────────────────
function addRow(item) {
  const tbody = document.getElementById('line-items-body');
  const tr = buildRow(item);
  tbody.appendChild(tr);
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
      type:        row.querySelector('[data-role="type"]').value,
      description: row.querySelector('[data-role="desc"]').value,
      qty, rate,
      total: qty * rate,
    };
  });

  const taxRate  = parseFloat(document.getElementById('tax-rate').value) || 0;
  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const taxAmt   = subtotal * taxRate / 100;

  return {
    id:          document.getElementById('inv-number').value.trim(),
    date:        document.getElementById('inv-date').value,
    dueDate:     document.getElementById('inv-due').value,
    terms:       document.getElementById('inv-terms').value,
    client: {
      name:    document.getElementById('client-name').value.trim(),
      address: document.getElementById('client-address').value.trim(),
      email:   document.getElementById('client-email').value.trim(),
      phone:   document.getElementById('client-phone').value.trim(),
    },
    lineItems,
    subtotal,
    taxRate,
    taxAmount: taxAmt,
    total:     subtotal + taxAmt,
    paymentLink: document.getElementById('payment-link-input').value.trim(),
    notes:       document.getElementById('notes').value.trim(),
    status:      'unpaid',
    createdAt:   new Date().toISOString(),
  };
}

// ── Save invoice ────────────────────────────────────────
function saveInvoice() {
  const inv = collectInvoice();
  if (!inv.client.name) { showAlert('Please enter a client name.', 'error'); return; }
  if (!inv.id)          { showAlert('Please enter an invoice number.', 'error'); return; }

  const list = getInvoices();
  const existing = list.findIndex(i => i.id === inv.id);
  if (existing >= 0) {
    if (!confirm(`Invoice ${inv.id} already exists. Overwrite it?`)) return;
    inv.status = list[existing].status;
    list[existing] = inv;
  } else {
    list.push(inv);
    bumpNextNum();
  }
  saveInvoices(list);
  showAlert(`Invoice ${inv.id} saved successfully!`);
}

// ── Invoice preview (for PDF) ──────────────────────────
function renderPreview(inv) {
  const cfg = TMT_CONFIG;
  const companyLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join(' · ');

  const itemRows = inv.lineItems.map(it => `
    <tr>
      <td>${escHtml(it.description)}</td>
      <td class="right">${it.qty}</td>
      <td class="right">${fmtMoney(it.rate)}</td>
      <td class="right">${fmtMoney(it.total)}</td>
    </tr>`).join('');

  const paymentBlock = inv.paymentLink
    ? `<div class="preview-payment">
         <strong>Payment:</strong>
         <a href="${escHtml(inv.paymentLink)}" target="_blank">${escHtml(inv.paymentLink)}</a>
       </div>`
    : '';

  const notesBlock = inv.notes
    ? `<div class="preview-notes"><strong>Notes:</strong> ${escHtml(inv.notes)}</div>`
    : '';

  const clientBlock = [
    inv.client.name    ? `<div class="client-name">${escHtml(inv.client.name)}</div>` : '',
    inv.client.address ? `<div>${escHtml(inv.client.address).replace(/\n/g,'<br>')}</div>` : '',
    inv.client.email   ? `<div>${escHtml(inv.client.email)}</div>` : '',
    inv.client.phone   ? `<div>${escHtml(inv.client.phone)}</div>` : '',
  ].join('');

  return `
    <div class="invoice-header">
      <div class="company-block">
        <div class="company-name">${escHtml(cfg.companyName)}</div>
        ${companyLines ? `<div class="company-sub">${escHtml(companyLines)}</div>` : ''}
      </div>
      <div class="invoice-meta-block">
        <div class="inv-number">Invoice ${escHtml(inv.id)}</div>
        <div class="inv-dates">
          Date: ${inv.date}<br>
          Terms: ${escHtml(inv.terms)}<br>
          Due: ${inv.dueDate}
        </div>
      </div>
    </div>

    <div class="preview-section-title">Bill To</div>
    <div class="preview-client">${clientBlock}</div>

    <div class="preview-section-title">Services</div>
    <table class="preview-items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="preview-totals">
      <table>
        <tr><td>Subtotal</td><td>${fmtMoney(inv.subtotal)}</td></tr>
        <tr><td>Tax (${inv.taxRate}%)</td><td>${fmtMoney(inv.taxAmount)}</td></tr>
        <tr class="grand"><td>Total</td><td>${fmtMoney(inv.total)}</td></tr>
      </table>
    </div>

    ${paymentBlock}
    ${notesBlock}
  `;
}

// ── Export PDF ──────────────────────────────────────────
async function exportPDF() {
  const inv = collectInvoice();
  const previewEl = document.getElementById('invoice-preview');
  previewEl.innerHTML = renderPreview(inv);
  previewEl.style.display = 'block';

  await new Promise(r => setTimeout(r, 80));

  try {
    const canvas = await html2canvas(previewEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    const imgH  = pageW / ratio;
    const pages = Math.ceil(imgH / pageH);

    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -i * pageH, pageW, imgH);
    }
    pdf.save(`TMT-Invoice-${inv.id}.pdf`);
  } catch (err) {
    showAlert('PDF export failed. Try saving the invoice first and printing from the browser.', 'error');
    console.error(err);
  }
}

// ── New invoice (reset form) ────────────────────────────
function newInvoice() {
  const nextNum = String(getNextNum()).padStart(3, '0');
  document.getElementById('inv-number').value = 'INV-' + nextNum;
  document.getElementById('inv-date').value   = today();
  document.getElementById('inv-terms').value  = 'Due on Receipt';
  const dueEl = document.getElementById('inv-due');
  dueEl.removeAttribute('data-manually-set');
  updateDueDate();

  ['client-name','client-address','client-email','client-phone','notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('payment-link-input').value = TMT_CONFIG.paymentLink;

  document.getElementById('tax-rate').value = TMT_CONFIG.defaultTaxRate;
  document.getElementById('line-items-body').innerHTML = '';
  rowCount = 0;
  addRow({ type: 'rental', description: 'Dumpster rental', qty: 1, rate: 0 });
  recalcTotals();

  const previewEl = document.getElementById('invoice-preview');
  if (previewEl) previewEl.style.display = 'none';
  document.getElementById('alert-box').style.display = 'none';
}

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wire up tax rate & date changes
  document.getElementById('tax-rate')?.addEventListener('input', recalcTotals);
  document.getElementById('inv-date')?.addEventListener('change', updateDueDate);
  document.getElementById('inv-terms')?.addEventListener('change', updateDueDate);
  document.getElementById('inv-due')?.addEventListener('input', function() {
    this.dataset.manuallySet = 'true';
  });

  // Button bindings
  document.getElementById('btn-add-row')?.addEventListener('click', () => addRow({}));
  document.getElementById('btn-save')?.addEventListener('click', saveInvoice);
  document.getElementById('btn-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-new')?.addEventListener('click', () => {
    if (confirm('Start a new invoice? Unsaved changes will be lost.')) newInvoice();
  });

  // Populate company info display
  const cfg = TMT_CONFIG;
  const companyLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join(' · ');
  const subEl = document.getElementById('company-sub');
  if (subEl) subEl.textContent = companyLines;

  newInvoice();
});
