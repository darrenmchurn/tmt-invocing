/* =====================================================
   TMT Invoicing — history.js
   Invoice history list, status toggle, preview, delete,
   and CSV/Excel export via SheetJS
   ===================================================== */

const LS_INVOICES = 'tmt_invoices';
const LS_NEXT_NUM = 'tmt_next_invoice_num';

const TMT_CONFIG = {
  companyName:  'TMT Waste Solutions',
  phone:        '',
  email:        '',
  address:      '',
  paymentLink:  '',
  paymentLabel: 'Pay Online',
};

// ── Helpers ────────────────────────────────────────────
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

// ── Render history table ────────────────────────────────
function renderHistory() {
  const invoices = getInvoices().slice().reverse();
  const tbody    = document.getElementById('history-body');
  const empty    = document.getElementById('empty-state');

  tbody.innerHTML = '';

  if (invoices.length === 0) {
    empty.style.display = 'block';
    document.getElementById('history-table').style.display = 'none';
    document.getElementById('btn-export-xlsx').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('history-table').style.display = 'table';
  document.getElementById('btn-export-xlsx').style.display = '';

  invoices.forEach(inv => {
    const tr = document.createElement('tr');
    if (inv.status === 'paid') tr.classList.add('paid');
    tr.innerHTML = `
      <td>${escHtml(inv.id)}</td>
      <td>${inv.date || ''}</td>
      <td>${escHtml(inv.client?.name || '—')}</td>
      <td>${fmtMoney(inv.total)}</td>
      <td>${inv.dueDate || ''}</td>
      <td class="no-click">
        <button class="btn btn-sm ${inv.status === 'paid' ? 'btn-ghost' : 'btn-success'}"
          onclick="toggleStatus('${escHtml(inv.id)}', event)">
          ${inv.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
      </td>
      <td class="no-click">
        <button class="btn btn-sm btn-danger"
          onclick="deleteInvoice('${escHtml(inv.id)}', event)">Delete</button>
      </td>
    `;
    tr.querySelector('td:nth-child(1)').addEventListener('click', () => previewInvoice(inv.id));
    tr.querySelector('td:nth-child(2)').addEventListener('click', () => previewInvoice(inv.id));
    tr.querySelector('td:nth-child(3)').addEventListener('click', () => previewInvoice(inv.id));
    tr.querySelector('td:nth-child(4)').addEventListener('click', () => previewInvoice(inv.id));
    tr.querySelector('td:nth-child(5)').addEventListener('click', () => previewInvoice(inv.id));
    tbody.appendChild(tr);
  });
}

// ── Toggle paid/unpaid ──────────────────────────────────
function toggleStatus(id, e) {
  e.stopPropagation();
  const list = getInvoices();
  const idx  = list.findIndex(i => i.id === id);
  if (idx < 0) return;
  list[idx].status = list[idx].status === 'paid' ? 'unpaid' : 'paid';
  saveInvoices(list);
  renderHistory();
}
window.toggleStatus = toggleStatus;

// ── Delete ──────────────────────────────────────────────
function deleteInvoice(id, e) {
  e.stopPropagation();
  if (!confirm(`Delete invoice ${id}? This cannot be undone.`)) return;
  const list = getInvoices().filter(i => i.id !== id);
  saveInvoices(list);
  renderHistory();
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

// ── Invoice HTML renderer ───────────────────────────────
function renderInvoiceHTML(inv) {
  const cfg = TMT_CONFIG;
  const companyLines = [cfg.phone, cfg.email, cfg.address].filter(Boolean).join(' · ');

  const itemRows = (inv.lineItems || []).map(it => `
    <tr>
      <td>${escHtml(it.description)}</td>
      <td class="right" style="text-align:right">${it.qty}</td>
      <td class="right" style="text-align:right">${fmtMoney(it.rate)}</td>
      <td class="right" style="text-align:right">${fmtMoney(it.total)}</td>
    </tr>`).join('');

  const paymentBlock = cfg.paymentLink
    ? `<div class="preview-payment">
         <strong>Payment:</strong>
         <a href="${escHtml(cfg.paymentLink)}" target="_blank">${escHtml(cfg.paymentLabel)}</a>
         — ${escHtml(cfg.paymentLink)}
       </div>`
    : '';

  const notesBlock = inv.notes
    ? `<div class="preview-notes"><strong>Notes:</strong> ${escHtml(inv.notes)}</div>`
    : '';

  const clientBlock = [
    inv.client?.name    ? `<div class="client-name">${escHtml(inv.client.name)}</div>` : '',
    inv.client?.address ? `<div>${escHtml(inv.client.address).replace(/\n/g,'<br>')}</div>` : '',
    inv.client?.email   ? `<div>${escHtml(inv.client.email)}</div>` : '',
    inv.client?.phone   ? `<div>${escHtml(inv.client.phone)}</div>` : '',
  ].join('');

  return `
    <div id="invoice-preview">
      <div class="invoice-header">
        <div class="company-block">
          <div class="company-name">${escHtml(cfg.companyName)}</div>
          ${companyLines ? `<div class="company-sub">${escHtml(companyLines)}</div>` : ''}
        </div>
        <div class="invoice-meta-block">
          <div class="inv-number">Invoice ${escHtml(inv.id)}</div>
          <div class="inv-dates">
            Date: ${inv.date}<br>
            Terms: ${escHtml(inv.terms || '')}<br>
            Due: ${inv.dueDate || ''}
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
    </div>
  `;
}

// ── PDF export from preview modal ──────────────────────
async function exportModalPDF() {
  const previewEl = document.getElementById('invoice-preview');
  if (!previewEl) { showAlert('Open an invoice preview first.', 'error'); return; }

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
    const invId = previewEl.querySelector('.inv-number')?.textContent?.replace('Invoice ','').trim() || 'export';
    pdf.save(`TMT-Invoice-${invId}.pdf`);
  } catch (err) {
    showAlert('PDF export failed.', 'error');
    console.error(err);
  }
}
window.exportModalPDF = exportModalPDF;

// ── Excel export (SheetJS) ──────────────────────────────
function exportXLSX() {
  const invoices = getInvoices();
  if (!invoices.length) { showAlert('No invoices to export.', 'error'); return; }

  const rows = [['Invoice #','Date','Due Date','Terms','Client Name','Client Address','Client Email','Client Phone','Subtotal','Tax Rate %','Tax Amount','Total','Status','Notes']];

  invoices.forEach(inv => {
    rows.push([
      inv.id,
      inv.date,
      inv.dueDate,
      inv.terms,
      inv.client?.name    || '',
      inv.client?.address || '',
      inv.client?.email   || '',
      inv.client?.phone   || '',
      inv.subtotal,
      inv.taxRate,
      inv.taxAmount,
      inv.total,
      inv.status,
      inv.notes,
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    {wch:12},{wch:12},{wch:12},{wch:16},{wch:24},{wch:30},{wch:28},{wch:16},
    {wch:12},{wch:10},{wch:12},{wch:12},{wch:10},{wch:30},
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, 'TMT-Invoice-History.xlsx');
  showAlert('Excel file downloaded!');
}
window.exportXLSX = exportXLSX;

// ── Summary stats ───────────────────────────────────────
function renderStats() {
  const invoices = getInvoices();
  const total     = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const paid      = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const unpaid    = total - paid;

  const el = document.getElementById('stats-bar');
  if (!el) return;
  el.innerHTML = `
    <span><strong>${invoices.length}</strong> invoices</span>
    <span>Total billed: <strong>${fmtMoney(total)}</strong></span>
    <span style="color:var(--success)">Paid: <strong>${fmtMoney(paid)}</strong></span>
    <span style="color:var(--danger)">Outstanding: <strong>${fmtMoney(unpaid)}</strong></span>
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
