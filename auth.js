/* =====================================================
   TMT Invoicing — auth.js
   Password gate for the invoice portal

   ⚠️  TO CHANGE THE PASSWORD:
       Edit the line below — that's the only line you
       need to touch. Then save and push to GitHub.
   ===================================================== */

const TMT_PASSWORD = 'TMTwaste2026';   // ← Change this

(function () {
  // Already authenticated this session → let straight through
  if (sessionStorage.getItem('tmt_auth') === '1') return;

  document.addEventListener('DOMContentLoaded', function () {

    // ── Styles (scoped to overlay) ──────────────────────
    const style = document.createElement('style');
    style.textContent = `
      #tmt-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: #1a3a5c;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      .tmt-login-card {
        background: #fff;
        border-radius: 10px;
        padding: 44px 40px 36px;
        width: 100%; max-width: 380px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.32);
        text-align: center;
        box-sizing: border-box;
      }
      .tmt-login-brand {
        font-size: 21px; font-weight: 800;
        color: #1a3a5c; letter-spacing: -0.01em;
        margin-bottom: 4px;
      }
      .tmt-login-sub {
        font-size: 13px; color: #6c7a89;
        margin-bottom: 32px;
      }
      .tmt-login-divider {
        width: 40px; height: 3px;
        background: #f0a500; border-radius: 2px;
        margin: 0 auto 28px;
      }
      #tmt-pw-input {
        width: 100%; padding: 12px 14px;
        border: 1.5px solid #d0d7de; border-radius: 6px;
        font-size: 15px; color: #1c2b3a;
        outline: none; box-sizing: border-box;
        transition: border-color .15s, box-shadow .15s;
        margin-bottom: 8px;
        text-align: center; letter-spacing: 0.1em;
      }
      #tmt-pw-input:focus {
        border-color: #1a3a5c;
        box-shadow: 0 0 0 3px #e8f0f8;
      }
      .tmt-login-error {
        color: #c0392b; font-size: 13px;
        min-height: 20px; margin-bottom: 12px;
        font-weight: 600;
      }
      #tmt-pw-btn {
        width: 100%; padding: 13px;
        background: #1a3a5c; color: #fff;
        border: none; border-radius: 6px;
        font-size: 15px; font-weight: 700;
        cursor: pointer;
        transition: opacity .15s, transform .1s;
        letter-spacing: 0.02em;
      }
      #tmt-pw-btn:hover  { opacity: .88; }
      #tmt-pw-btn:active { transform: scale(.97); }
      .tmt-login-footer {
        margin-top: 20px; font-size: 12px; color: #b0bec5;
      }
      @media (max-width: 440px) {
        .tmt-login-card { padding: 36px 24px 28px; margin: 16px; }
      }
    `;
    document.head.appendChild(style);

    // ── Overlay HTML ────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'tmt-overlay';
    overlay.innerHTML = `
      <div class="tmt-login-card">
        <div class="tmt-login-brand">TMT Waste Solutions</div>
        <div class="tmt-login-sub">Staff Invoice Portal</div>
        <div class="tmt-login-divider"></div>
        <input type="password" id="tmt-pw-input"
               placeholder="Enter password"
               autocomplete="current-password">
        <div class="tmt-login-error" id="tmt-pw-error"></div>
        <button id="tmt-pw-btn">Sign In</button>
        <div class="tmt-login-footer">Authorised staff only</div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('tmt-pw-input').focus();

    // ── Login logic ─────────────────────────────────────
    function attempt() {
      const val = document.getElementById('tmt-pw-input').value;
      const err = document.getElementById('tmt-pw-error');

      if (val === TMT_PASSWORD) {
        sessionStorage.setItem('tmt_auth', '1');
        overlay.style.transition = 'opacity .25s';
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); style.remove(); }, 250);
      } else {
        err.textContent = 'Incorrect password — please try again.';
        document.getElementById('tmt-pw-input').value = '';
        document.getElementById('tmt-pw-input').focus();
        // Brief shake on the card
        const card = overlay.querySelector('.tmt-login-card');
        card.style.transition = 'transform .08s';
        card.style.transform = 'translateX(8px)';
        setTimeout(() => { card.style.transform = 'translateX(-8px)'; }, 80);
        setTimeout(() => { card.style.transform = 'translateX(0)'; }, 160);
      }
    }

    document.getElementById('tmt-pw-btn')
      .addEventListener('click', attempt);
    document.getElementById('tmt-pw-input')
      .addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  });
})();
