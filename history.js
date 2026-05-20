/* =====================================================
   TMT Invoicing — history.js
   ===================================================== */

const LS_INVOICES = 'tmt_invoices';

const TMT_CONFIG = {
  companyName:  'TMT Waste Solutions',
  phone:        '',
  email:        '',
  address:      '',
  paymentLink:  '',
  paymentLabel: 'Pay Online',
};

function getInvoices() {
  return JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
}
function saveInvoices(arr) {
  localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
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

// ── Compute status from invoice-level paid amount ──────
function computeStatus(inv) {
  const paid  = parseFloat(inv.paidAmount) || 0;
  const total = parseFloat(inv.total) || 0;
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

// ── Status badge HTML ──────────────────────────────────
function statusBadge(status) {
  const map = {
    paid:    '<span class="badge badge-paid">Paid</span>',
    partial: '<span class="badge badge-partial">Partial</span>',
    unpaid:  '<span class="badge badge-unpaid">Unpaid</span>',
  };
  return map[status] || map.unpaid;
}

// ── Render history table ────────────────────────────────
function renderHistory() {
  const invoices = getInvoices().slice().reverse();
  const tbody    = document.getElementById('history-body');
  const empty    = document.getElementById('empty-state');

  tbody.innerHTML = '';

  if (!invoices.length) {
    empty.style.display = 'block';
    document.getElementById('history-table').style.display = 'none';
    document.getElementById('btn-export-xlsx').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('history-table').style.display = 'table';
  document.getElementById('btn-export-xlsx').style.display = '';

  invoices.forEach(inv => {
    const status  = computeStatus(inv);
    const paid    = parseFloat(inv.paidAmount) || 0;
    const balance = parseFloat(inv.balanceDue) ?? (inv.total - paid);
    const ver     = inv.version || 1;

    const tr = document.createElement('tr');
    if (status === 'paid') tr.classList.add('paid');

    tr.innerHTML = `
      <td class="col-inv-id">${escHtml(inv.id)} <span class="version-badge">v${ver}</span> ${statusBadge(status)}</td>
      <td data-label="Date">${inv.date || ''}</td>
      <td data-label="Client">${escHtml(inv.client?.name || '—')}</td>
      <td data-label="Total">${fmtMoney(inv.total)}</td>
      <td data-label="Paid">${fmtMoney(paid)}</td>
      <td data-label="Balance">${fmtMoney(balance)}</td>
      <td data-label="Due">${inv.dueDate || ''}</td>
      <td class="col-status-cell">${statusBadge(status)}</td>
      <td class="no-click">
        <button class="btn btn-sm ${status === 'paid' ? 'btn-ghost' : 'btn-success'}"
          onclick="togglePaid('${escHtml(inv.id)}', event)">
          ${status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
        <button class="btn btn-sm btn-accent"
          onclick="markPartial('${escHtml(inv.id)}', event)">Partial</button>
        <a class="btn btn-sm btn-ghost" href="index.html?edit=${encodeURIComponent(inv.id)}">Edit</a>
        <button class="btn btn-sm btn-danger"
          onclick="deleteInvoice('${escHtml(inv.id)}', event)">Delete</button>
      </td>
    `;

    // Click data cells to open preview
    [...tr.querySelectorAll('td:not(.no-click)')].forEach(td =>
      td.addEventListener('click', () => previewInvoice(inv.id))
    );
    tbody.appendChild(tr);
  });
}

// ── Mark Paid / Unpaid ─────────────────────────────────
function togglePaid(id, e) {
  e.stopPropagation();
  const list = getInvoices();
  const idx  = list.findIndex(i => i.id === id);
  if (idx < 0) return;

  const inv    = list[idx];
  const status = computeStatus(inv);

  if (status !== 'paid') {
    inv.paidAmount = inv.total;
    inv.balanceDue = 0;
    inv.status     = 'paid';
  } else {
    inv.paidAmount = 0;
    inv.balanceDue = inv.total;
    inv.status     = 'unpaid';
  }

  list[idx] = inv;
  saveInvoices(list);
  renderHistory();
  renderStats();
}
window.togglePaid = togglePaid;

// ── Mark Partially Paid ────────────────────────────────
function markPartial(id, e) {
  e.stopPropagation();
  const list = getInvoices();
  const idx  = list.findIndex(i => i.id === id);
  if (idx < 0) return;

  const inv    = list[idx];
  const current = parseFloat(inv.paidAmount) || 0;
  const amtStr  = prompt(
    `Invoice ${id}  —  Total: ${fmtMoney(inv.total)}\nCurrently paid: ${fmtMoney(current)}\n\nEnter amount paid:`
  );
  if (amtStr === null) return; // cancelled

  const amt = parseFloat(amtStr);
  if (isNaN(amt) || amt < 0) { showAlert('Invalid amount entered.', 'error'); return; }

  inv.paidAmount = amt;
  inv.balanceDue = inv.total - amt;
  inv.status     = amt >= inv.total ? 'paid' : (amt <= 0 ? 'unpaid' : 'partial');

  list[idx] = inv;
  saveInvoices(list);
  renderHistory();
  renderStats();
}
window.markPartial = markPartial;

// ── Delete ──────────────────────────────────────────────
function deleteInvoice(id, e) {
  e.stopPropagation();
  if (!confirm(`Delete invoice ${id}? This cannot be undone.`)) return;
  saveInvoices(getInvoices().filter(i => i.id !== id));
  renderHistory();
  renderStats();
  showAlert(`Invoice ${id} deleted.`);
}
window.deleteInvoice = deleteInvoice;

// ── Preview modal ───────────────────────────────────────
function previewInvoice(id) {
  const inv = getInvoices().find(i => i.id === id);
  if (!inv) return;
  document.getElementById('modal-body').innerHTML = renderInvoiceHTML(inv);
  document.getElementById('preview-modal').classList.add('open');
}
window.previewInvoice = previewInvoice;

function closeModal() {
  document.getElementById('preview-modal').classList.remove('open');
}
window.closeModal = closeModal;

// ── Invoice HTML renderer (modal + PDF) ────────────────
function renderInvoiceHTML(inv) {
  const cfg          = TMT_CONFIG;
  const companyLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join(' · ');

  const itemRows = (inv.lineItems || []).map(it => `
    <tr>
      <td>${escHtml(it.description)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${fmtMoney(it.rate)}</td>
      <td style="text-align:right">${fmtMoney(it.total)}</td>
    </tr>`).join('');

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
    inv.client?.name    ? `<div class="client-name">${escHtml(inv.client.name)}</div>`        : '',
    inv.client?.address ? `<div>${escHtml(inv.client.address).replace(/\n/g,'<br>')}</div>`   : '',
    inv.client?.email   ? `<div>${escHtml(inv.client.email)}</div>`                           : '',
    inv.client?.phone   ? `<div>${escHtml(inv.client.phone)}</div>`                           : '',
  ].join('');

  return `
    <div id="invoice-preview">
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
    </div>
  `;
}

// ── PDF from modal ──────────────────────────────────────
async function exportModalPDF() {
  const previewEl = document.getElementById('invoice-preview');
  if (!previewEl) { showAlert('Open an invoice first.', 'error'); return; }
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
    const invId = previewEl.querySelector('.inv-number')?.textContent?.split(' ')[1]?.trim() || 'export';
    pdf.save(`TMT-Invoice-${invId}.pdf`);
  } catch (err) {
    showAlert('PDF export failed.', 'error');
    console.error(err);
  }
}
window.exportModalPDF = exportModalPDF;

// ── Excel export ────────────────────────────────────────
function exportXLSX() {
  const invoices = getInvoices();
  if (!invoices.length) { showAlert('No invoices to export.', 'error'); return; }

  const rows = [[
    'Invoice #','Version','Date','Due Date','Terms',
    'Client Name','Client Address','Client Email','Client Phone',
    'Subtotal','Tax Rate %','Tax Amount','Total','Amount Paid','Balance Due',
    'Status','Notes'
  ]];

  invoices.forEach(inv => {
    const status  = computeStatus(inv);
    const paid    = parseFloat(inv.paidAmount) || 0;
    const balance = parseFloat(inv.balanceDue) ?? (inv.total - paid);
    rows.push([
      inv.id, inv.version || 1, inv.date, inv.dueDate, inv.terms,
      inv.client?.name||'', inv.client?.address||'',
      inv.client?.email||'', inv.client?.phone||'',
      inv.subtotal, inv.taxRate, inv.taxAmount, inv.total,
      paid, balance, status, inv.notes,
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    {wch:12},{wch:8},{wch:12},{wch:12},{wch:16},
    {wch:24},{wch:30},{wch:28},{wch:16},
    {wch:12},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10},{wch:30},
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, 'TMT-Invoice-History.xlsx');
  showAlert('Excel file downloaded!');
}
window.exportXLSX = exportXLSX;

// ── Stats ───────────────────────────────────────────────
function renderStats() {
  const invoices = getInvoices();
  const total    = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const paid     = invoices.reduce((s, i) => s + (parseFloat(i.paidAmount) || 0), 0);
  const balance  = total - paid;
  const partial  = invoices.filter(i => computeStatus(i) === 'partial').length;

  const el = document.getElementById('stats-bar');
  if (!el) return;
  el.innerHTML = `
    <span><strong>${invoices.length}</strong> invoices</span>
    <span>Total billed: <strong>${fmtMoney(total)}</strong></span>
    <span style="color:var(--success)">Collected: <strong>${fmtMoney(paid)}</strong></span>
    <span style="color:var(--danger)">Outstanding: <strong>${fmtMoney(balance)}</strong></span>
    ${partial ? `<span style="color:var(--accent)"><strong>${partial}</strong> partial</span>` : ''}
  `;
}

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  renderStats();
  document.getElementById('btn-export-xlsx')?.addEventListener('click', exportXLSX);
  document.getElementById('preview-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('preview-modal')) closeModal();
  });
  document.getElementById('btn-modal-pdf')?.addEventListener('click', exportModalPDF);
  document.getElementById('btn-modal-close')?.addEventListener('click', closeModal);
});
