// fx.js
// Base currency is ILS. We persist rates in IndexedDB so it works offline across reloads.

window.DEFAULT_FX = {
  base: 'ILS',
  ratesToILS: {
    ILS: 1,
    USD: 3.222795,
    EUR: 3.783122,
    THB: 0.1015732826,
    NPR: 0.0221813345,
    ARS: 0.0022386907,
    BRL: 0.5939565,
    CLP: 0.0034989218,
    PEN: 0.8916722229,
    COP: 0.0008442975,
    BOB: 0.4647277565,
    UYU: 0.0819357605,
    PYG: 0.0004778981,
    MXN: 0.1780734199,
    CRC: 0.0064192632
  },
  updatedAt: null
};

window.FX = { ...DEFAULT_FX };

window.fxToILS = function fxToILS(amount, currency) {
  const cur = String(currency || '').trim().toUpperCase();
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;

  const rate = window.FX.ratesToILS[cur];
  if (typeof rate !== 'number') return null;

  return n * rate;
};

// Load saved FX from IndexedDB (if available), else keep defaults
window.fxInit = async function fxInit() {
  if (!window.dbGetSetting) return; // db.js not loaded yet
  const saved = await window.dbGetSetting('fx');
  if (saved && saved.ratesToILS) {
    window.FX = saved;
  } else {
    // First run: save defaults so they persist
    await window.dbSetSetting('fx', window.FX);
  }
};

// Save current FX to IndexedDB
window.fxSave = async function fxSave() {
  if (!window.dbSetSetting) return;
  window.FX.updatedAt = new Date().toISOString();
  await window.dbSetSetting('fx', window.FX);
};

// Restore default FX (and persist)
window.fxRestoreDefaults = async function fxRestoreDefaults() {
  // DEFAULT_FX is in fx.js file scope
  window.FX = JSON.parse(JSON.stringify(DEFAULT_FX));
  window.FX.updatedAt = null;
  if (window.dbSetSetting) await window.dbSetSetting('fx', window.FX);
};

