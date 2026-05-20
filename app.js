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

const DEFAULT_BILLING_CODES = [
  { id: 'bc1', name: 'Bin 2001 - 25 yard - 3 day', defaultPrice: 350 },
  { id: 'bc2', name: 'Bin 2001 - 25 yard - 5 day', defaultPrice: 400 },
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
  return JSON.parse(stored);
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
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Line-item row builder ──────────────────────────────
let rowCount = 0;

function buildRow(item = {}) {
  rowCount++;
  const codes     = getBillingCodes();
  const savedCode = item.billingCodeId || '';
  const desc      = item.description   || '';
  const qty       = item.qty           ?? 1;
  const rate      = item.rate          ?? 0;
  const lineTotal = item.total         ?? 0;
  const paid      = item.paid          ?? 0;

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
    <td class="col-paid" data-label="Paid ($)">
      <input type="number" data-role="paid" value="${paid || ''}" min="0" step="0.01" placeholder="0.00" inputmode="decimal" oninput="recalcTotals()">
    </td>
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
  let subtotal  = 0;
  let paidTotal = 0;

  rows.forEach(row => {
    const qty  = parseFloat(row.querySelector('[data-role="qty"]')?.value)  || 0;
    const rate = parseFloat(row.querySelector('[data-role="rate"]')?.value) || 0;
    const paid = parseFloat(row.querySelector('[data-role="paid"]')?.value) || 0;
    subtotal  += qty * rate;
    paidTotal += paid;
  });

  const taxRate = parseFloat(document.getElementById('tax-rate')?.value) || 0;
  const taxAmt  = subtotal * taxRate / 100;
  const total   = subtotal + taxAmt;
  const balance = total - paidTotal;

  document.getElementById('subtotal-display').textContent = fmtMoney(subtotal);
  document.getElementById('tax-amt-display').textContent  = fmtMoney(taxAmt);
  document.getElementById('total-display').textContent    = fmtMoney(total);
  document.getElementById('paid-display').textContent     = fmtMoney(paidTotal);
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
    const paid = parseFloat(row.querySelector('[data-role="paid"]').value) || 0;
    return {
      billingCodeId: row.querySelector('[data-role="type"]').value,
      description:   row.querySelector('[data-role="desc"]').value,
      qty, rate, paid,
      total: qty * rate,
    };
  });

  const taxRate  = parseFloat(document.getElementById('tax-rate').value) || 0;
  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const taxAmt   = subtotal * taxRate / 100;
  const total    = subtotal + taxAmt;
  const paid     = lineItems.reduce((s, i) => s + i.paid, 0);

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
    paidAmount: paid,
    balanceDue: total - paid,
    paymentLink: document.getElementById('payment-link-input').value.trim(),
    notes:       document.getElementById('notes').value.trim(),
    status:      computeStatus(lineItems, total, paid),
    createdAt:   document.getElementById('inv-created-at').value || new Date().toISOString(),
  };
}

// ── Compute status from line items ─────────────────────
function computeStatus(lineItems, total, paid) {
  if (!lineItems || lineItems.length === 0) return 'unpaid';
  if (paid <= 0) return 'unpaid';
  // Partial if any line item has paid < its total
  const allPaid = lineItems.every(li => (parseFloat(li.paid) || 0) >= li.total);
  return allPaid ? 'paid' : 'partial';
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

// ── Invoice preview renderer ───────────────────────────
function renderPreview(inv) {
  const cfg          = TMT_CONFIG;
  const companyLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join(' · ');

  const itemRows = inv.lineItems.map(it => {
    const itemPaid = parseFloat(it.paid) || 0;
    return `
    <tr>
      <td>${escHtml(it.description)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${fmtMoney(it.rate)}</td>
      <td style="text-align:right">${fmtMoney(it.total)}</td>
      <td style="text-align:right">${fmtMoney(itemPaid)}</td>
    </tr>`;
  }).join('');

  const paid    = parseFloat(inv.paidAmount) || 0;
  const balance = parseFloat(inv.balanceDue) ?? (inv.total - paid);

  const paymentBlock = inv.paymentLink
    ? `<div class="preview-payment"><strong>Payment:</strong>
         <a href="${escHtml(inv.paymentLink)}" target="_blank">${escHtml(inv.paymentLink)}</a></div>`
    : '';

  const notesBlock = inv.notes
    ? `<div class="preview-notes"><strong>Notes:</strong> ${escHtml(inv.notes)}</div>`
    : '';

  const clientBlock = [
    inv.client?.name    ? `<div class="client-name">${escHtml(inv.client.name)}</div>`             : '',
    inv.client?.address ? `<div>${escHtml(inv.client.address).replace(/\n/g,'<br>')}</div>`        : '',
    inv.client?.email   ? `<div>${escHtml(inv.client.email)}</div>`                                : '',
    inv.client?.phone   ? `<div>${escHtml(inv.client.phone)}</div>`                                : '',
  ].join('');

  return `
    <div class="invoice-header">
      <div class="company-block">
        <div class="company-name">${escHtml(cfg.companyName)}</div>
        ${companyLines ? `<div class="company-sub">${escHtml(companyLines)}</div>` : ''}
      </div>
      <div class="invoice-meta-block">
        <div class="inv-number">Invoice ${escHtml(inv.id)} <span style="font-size:12px;color:#888">v${inv.version||1}</span></div>
        <div class="inv-dates">
          Date: ${inv.date}<br>Terms: ${escHtml(inv.terms||'')}<br>Due: ${inv.dueDate||''}
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
          <th style="text-align:right">Paid</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="preview-totals">
      <table>
        <tr><td>Subtotal</td><td>${fmtMoney(inv.subtotal)}</td></tr>
        <tr><td>Tax (${inv.taxRate}%)</td><td>${fmtMoney(inv.taxAmount)}</td></tr>
        <tr class="grand"><td>Total</td><td>${fmtMoney(inv.total)}</td></tr>
        <tr><td>Amount Paid</td><td>${fmtMoney(paid)}</td></tr>
        <tr class="grand"><td>Balance Due</td><td>${fmtMoney(balance)}</td></tr>
      </table>
    </div>
    ${paymentBlock}
    ${notesBlock}
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
  document.getElementById('tax-rate').value           = TMT_CONFIG.defaultTaxRate;

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
  document.getElementById('tax-rate')?.addEventListener('input', recalcTotals);
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
