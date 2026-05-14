# TMT Waste Solutions — Invoicing App

A lightweight invoice tool that runs entirely from GitHub Pages. No server required — all data is stored in your browser's localStorage.

## Setup: Fill in Your Business Info

Open `app.js` and `history.js` and update the `TMT_CONFIG` block near the top of each file:

```js
const TMT_CONFIG = {
  companyName:   'TMT Waste Solutions',
  phone:         '(555) 123-4567',       // your phone
  email:         'billing@tmtrolloff.com', // your email
  address:       '123 Main St, City, ST 12345', // your address
  defaultTaxRate: 8.5,                   // your local tax rate %
  paymentLink:   'https://...',          // your payment URL
  paymentLabel:  'Pay Online',           // link label on invoice
};
```

> Update this block in **both** `app.js` and `history.js`.

---

## Deploy to GitHub Pages

1. Create a new repo on GitHub named `tmtinvoicing` (or any name you like)
2. Push all files from `C:\tmtinvoicing\` to the `main` branch
3. Go to **Settings → Pages** in your repo
4. Under **Source**, select `main` branch and `/ (root)` folder
5. Click **Save** — your site will be live at:
   ```
   https://<your-github-username>.github.io/tmtinvoicing/
   ```

---

## Running Locally

Just open `index.html` directly in your browser — no web server needed.

---

## Features

- **New Invoice** — fill out client info, add line items (dumpster rental, delivery, overage, extended rental, or custom), auto-calculates tax and totals
- **Export PDF** — downloads a print-ready PDF of the invoice
- **Save Invoice** — stores invoice in browser localStorage
- **Invoice History** — view all past invoices, toggle paid/unpaid status, preview any invoice
- **Export to Excel** — downloads all invoice history as a `.xlsx` file

## Important Notes

- **localStorage is per-browser and per-device.** If you clear browser data or switch browsers/computers, invoice history will be lost. Export to Excel regularly as a backup.
- The PDF and Excel export use CDN libraries (jsPDF, html2canvas, SheetJS) — an internet connection is required for those features.
