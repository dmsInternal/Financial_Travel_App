// app.js
// Offline-first Travel Finance App (Stage 1/1.5)
// - Local entries in IndexedDB (db.js)
// - FX conversions (fx.js) + editable FX table in Settings
// - Export/Import for upgrades
// - Basic home metrics + editable "Last entries"

/* =========================================================
   0) Static data (from data.js)
   ========================================================= */
const CATEGORIES = window.CATEGORIES || [];
const PAYMENT_METHODS = window.PAYMENT_METHODS || [];
const CASH_WALLETS = window.CASH_WALLETS || [];
const CURRENCIES = window.CURRENCIES || [];

/* =========================================================
   1) DOM: main UI
   ========================================================= */
// Home
const fab = document.getElementById('fab');
const lastEntriesEl = document.getElementById('lastEntries');
const todayValueEl = document.getElementById('todaySpend');

// Category picker modal
const categoryModal = document.getElementById('categoryModal');
const closeCategoryModalBtn = document.getElementById('closeCategoryModal');
const grid = document.getElementById('categoryGrid');

// Form modal
const formModal = document.getElementById('formModal');
const closeFormModalBtn = document.getElementById('closeFormModal');
const formTitle = document.getElementById('formTitle');
const entryForm = document.getElementById('entryForm');

const cancelBtn = document.getElementById('cancelBtn');
const deleteBtn = document.getElementById('deleteBtn');
const saveBtn = document.getElementById('saveBtn');

// Form sections
const multidayBox = document.getElementById('multidayBox');
const withdrawalBox = document.getElementById('withdrawalBox');

/* =========================================================
   2) DOM: form fields
   ========================================================= */
// Common fields
const f_description = document.getElementById('f_description');
const f_date = document.getElementById('f_date');
const f_country = document.getElementById('f_country');
const f_place = document.getElementById('f_place');
const f_amount = document.getElementById('f_amount');
const f_currency = document.getElementById('f_currency'); // <select>
const f_paymentMethod = document.getElementById('f_paymentMethod');

const f_isRefund = document.getElementById('f_isRefund');
const f_isMultiday = document.getElementById('f_isMultiday');
const f_duration = document.getElementById('f_duration');
const f_endDate = document.getElementById('f_endDate');

const f_notes = document.getElementById('f_notes');

// Withdrawal-only fields
const f_withdrawalSource = document.getElementById('f_withdrawalSource');
const f_cashWallet = document.getElementById('f_cashWallet');
const f_cashAmount = document.getElementById('f_cashAmount');
const f_cashCurrency = document.getElementById('f_cashCurrency'); // <select>
const f_feeAmount = document.getElementById('f_feeAmount');
const f_feeCurrency = document.getElementById('f_feeCurrency'); // <select>

/* =========================================================
   3) DOM: Settings modal
   ========================================================= */
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModal');

const s_lastSync = document.getElementById('s_lastSync');
const s_fxUpdated = document.getElementById('s_fxUpdated');
const s_version = document.getElementById('s_version');

const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const importFile = document.getElementById('importFile');

const btnRestoreDefaults = document.getElementById('btnRestoreDefaults');
const btnResetLocal = document.getElementById('btnResetLocal');

// FX extras in Settings
const btnCheckFx = document.getElementById('btnCheckFx');
const s_fxNote = document.getElementById('s_fxNote');
const fxTable = document.getElementById('fxTable');

/* =========================================================
   4) App state (editing + selected category)
   ========================================================= */
let selectedCategory = null;

// Editing state
let editingEntryId = null;
// Keep original created timestamp when editing (so sorting remains stable)
let editingOriginalTimestampCreated = null;

/* =========================================================
   5) App version (manual bump when you ship)
   ========================================================= */
const APP_VERSION = 'v0.1.0';

/* =========================================================
   6) Generic helpers
   ========================================================= */

// Date helpers
function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseYMD(ymd) {
  const [y, m, d] = (ymd || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(ymd, daysToAdd) {
  const dt = parseYMD(ymd);
  if (!dt) return null;
  dt.setDate(dt.getDate() + daysToAdd);
  return formatYMD(dt);
}

function diffDaysInclusive(startYMD, endYMD) {
  const a = parseYMD(startYMD);
  const b = parseYMD(endYMD);
  if (!a || !b) return 1;
  const ms = b.getTime() - a.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days + 1);
}

// Input helpers
function toNumberOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function toUpperTrim(x) {
  return String(x || '').trim().toUpperCase();
}

// UUID helper (offline-safe)
function uuid() {
  return (crypto?.randomUUID && crypto.randomUUID()) || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Simple datetime formatting for Settings display
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/* =========================================================
   7) Modal helpers (keeps background scroll locked)
   ========================================================= */
function anyModalOpen() {
  return [categoryModal, formModal, settingsModal].some(m => m && !m.classList.contains('hidden'));
}

function openModal(el) {
  if (!el) return;
  el.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal(el) {
  if (!el) return;
  el.classList.add('hidden');
  // Only remove lock if nothing else is open
  if (!anyModalOpen()) document.body.classList.remove('modal-open');
}

// ---------- Per-day spend helpers (for multi-day entries) ----------
function isDateInRangeInclusive(targetYMD, startYMD, endYMD) {
  const t = parseYMD(targetYMD);
  const a = parseYMD(startYMD);
  const b = parseYMD(endYMD);
  if (!t || !a || !b) return false;

  // Normalize to midnight
  t.setHours(0, 0, 0, 0);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  return t >= a && t <= b;
}

function calcSpendILSForDate(entries, targetYMD) {
  let sum = 0;

  for (const v of entries) {
    if (!v) continue;

    // Withdrawals: count only feeILS (if date matches)
    if (v.isCashWithdrawal) {
      if (v.date === targetYMD) sum += Number(v.feeILS || 0);
      continue;
    }

    // Must have amountILS to count
    if (v.amountILS === null || v.amountILS === undefined) continue;

    const sign = v.isRefund ? -1 : 1;
    const amountILS = Number(v.amountILS || 0);

    // Multi-day: spread evenly across duration days
    if (v.isMultiday && v.duration && (v.endDate || v.date)) {
      const start = v.date;
      const end = v.endDate || addDays(v.date, Number(v.duration) - 1);
      const dur = Math.max(1, Number(v.duration) || 1);

      if (isDateInRangeInclusive(targetYMD, start, end)) {
        sum += sign * (amountILS / dur);
      }
      continue;
    }

    // Normal one-day: count only on its date
    if (v.date === targetYMD) {
      sum += sign * amountILS;
    }
  }

  // round nicely
  return Number(sum.toFixed(2));
}


/* =========================================================
   8) Edit mode UI
   ========================================================= */
function setEditMode(entryIdOrNull, originalCreatedOrNull = null) {
  editingEntryId = entryIdOrNull;
  editingOriginalTimestampCreated = originalCreatedOrNull;

  if (editingEntryId) {
    deleteBtn?.classList.remove('hidden');
    if (saveBtn) saveBtn.textContent = 'Update';
  } else {
    deleteBtn?.classList.add('hidden');
    if (saveBtn) saveBtn.textContent = 'Save';
  }
}

/* =========================================================
   9) Select helpers (dropdowns)
   ========================================================= */
function fillSelect(selectEl, options, getValue, getLabel) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = getValue(o);
    opt.textContent = getLabel(o);
    selectEl.appendChild(opt);
  });
}

function setSelectIfExists(selectEl, value) {
  if (!selectEl) return;
  const v = String(value ?? '');
  if ([...selectEl.options].some(o => o.value === v)) {
    selectEl.value = v;
  }
}

/* =========================================================
   10) Category Picker modal
   ========================================================= */
function openCategoryModal() {
  // Mobile UX: always start at top
  const content = categoryModal?.querySelector('.modal-content');
  if (content) content.scrollTop = 0;
  openModal(categoryModal);
}

function closeCategoryModal() {
  closeModal(categoryModal);
}

function renderCategories() {
  if (!grid) return;
  grid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const tile = document.createElement('div');
    tile.className = 'category-tile';
    tile.setAttribute('aria-label', cat.name);

    tile.innerHTML = `
      <span class="material-symbols" style="color:${cat.color}">${cat.icon}</span>
      <div class="category-name">${cat.name}</div>
    `;

    tile.addEventListener('click', () => {
      closeCategoryModal();
      onCategorySelected(cat);
    });

    grid.appendChild(tile);
  });
}

/* =========================================================
   11) Form modal: open/reset + multi-day logic
   ========================================================= */
function openFormModal() {
  openModal(formModal);
  // Small UX: focus first field after opening
  setTimeout(() => f_description?.focus(), 0);
}

function closeFormModal() {
  closeModal(formModal);
}

// Reset form to a predictable state each time
function resetFormDefaults() {
  entryForm?.reset();

  // Default date: today
  if (f_date) f_date.value = todayYYYYMMDD();

  // Multi-day defaults
  if (f_isMultiday) f_isMultiday.checked = false;
  multidayBox?.classList.add('hidden');
  if (f_duration) f_duration.value = 1;
  if (f_endDate) f_endDate.value = '';

  // Default currencies
  setSelectIfExists(f_currency, 'ILS');
  setSelectIfExists(f_feeCurrency, 'ILS');
  setSelectIfExists(f_cashCurrency, f_currency?.value || 'ILS');

  // Hide withdrawals by default (will enable if needed)
  withdrawalBox?.classList.add('hidden');

  // Clear editing state
  setEditMode(null);
}

// Multi-day: duration → end date
function syncEndDateFromDuration() {
  if (!f_isMultiday?.checked) return;

  const start = f_date?.value;
  const dur = Math.max(1, Number(f_duration?.value || 1));
  if (f_duration) f_duration.value = dur;

  const end = addDays(start, dur - 1);
  if (end && f_endDate) f_endDate.value = end;
}

// Multi-day: end date → duration
function syncDurationFromEndDate() {
  if (!f_isMultiday?.checked) return;
  const start = f_date?.value;
  const end = f_endDate?.value;
  if (!end) return;

  if (f_duration) f_duration.value = diffDaysInclusive(start, end);
}

// Keep cash currency aligned when main currency changes (soft rule)
let lastMainCurrency = null;
f_currency?.addEventListener('change', () => {
  const cur = toUpperTrim(f_currency.value);
  if (!lastMainCurrency) lastMainCurrency = cur;

  // If cashCurrency currently matched the old main currency, follow new one
  if (toUpperTrim(f_cashCurrency?.value) === lastMainCurrency) {
    setSelectIfExists(f_cashCurrency, cur);
  }
  lastMainCurrency = cur;
});

/* =========================================================
   12) Category chosen → set up form for Expense vs Withdrawal
   ========================================================= */
function onCategorySelected(cat) {
  selectedCategory = cat;

  // Always populate dropdowns before setting values
  fillSelect(f_paymentMethod, PAYMENT_METHODS, o => o.id, o => o.name);
  fillSelect(f_withdrawalSource, PAYMENT_METHODS, o => o.id, o => o.name);
  fillSelect(f_cashWallet, CASH_WALLETS, o => o.id, o => o.name);

  fillSelect(f_currency, CURRENCIES, o => o.code, o => o.name);
  fillSelect(f_cashCurrency, CURRENCIES, o => o.code, o => o.name);
  fillSelect(f_feeCurrency, CURRENCIES, o => o.code, o => o.name);

  resetFormDefaults();

  // Header
  if (formTitle) {
    formTitle.textContent = (cat.type === 'withdrawal') ? 'Add cash withdrawal' : `Add ${cat.name}`;
  }

  // Withdrawal section toggle + defaults
  if (cat.type === 'withdrawal') {
    withdrawalBox?.classList.remove('hidden');
    if (f_description) f_description.placeholder = 'e.g., ATM withdrawal';
    setSelectIfExists(f_feeCurrency, 'ILS');
    setSelectIfExists(f_cashCurrency, f_currency?.value || 'ILS');
  } else {
    withdrawalBox?.classList.add('hidden');
    if (f_description) f_description.placeholder = 'e.g., Dinner at...';
  }

  lastMainCurrency = toUpperTrim(f_currency?.value);
  openFormModal();
}

/* =========================================================
   13) Multi-day field event wiring
   ========================================================= */
f_duration?.addEventListener('input', syncEndDateFromDuration);
f_endDate?.addEventListener('change', syncDurationFromEndDate);

// If start date changes, recompute end date based on duration
f_date?.addEventListener('change', () => {
  if (f_isMultiday?.checked) syncEndDateFromDuration();
});

// Toggle multi-day UI
f_isMultiday?.addEventListener('change', () => {
  if (f_isMultiday.checked) {
    multidayBox?.classList.remove('hidden');
    // If no end date, compute from duration; otherwise compute duration from end date
    if (!f_endDate?.value) syncEndDateFromDuration();
    else syncDurationFromEndDate();
  } else {
    multidayBox?.classList.add('hidden');
    if (f_duration) f_duration.value = 1;
    if (f_endDate) f_endDate.value = '';
  }
});

/* =========================================================
   14) Edit entry: open and populate the form
   ========================================================= */
async function openEditEntry(entryId) {
  const en = await window.dbGetEntry?.(entryId);
  if (!en) return;

  const cat = CATEGORIES.find(c => c.id === en.categoryId);
  if (!cat) return;

  selectedCategory = cat;
  setEditMode(en.entryId, en.timestampCreated || null);

  // Populate dropdowns
  fillSelect(f_paymentMethod, PAYMENT_METHODS, o => o.id, o => o.name);
  fillSelect(f_withdrawalSource, PAYMENT_METHODS, o => o.id, o => o.name);
  fillSelect(f_cashWallet, CASH_WALLETS, o => o.id, o => o.name);

  fillSelect(f_currency, CURRENCIES, o => o.code, o => o.name);
  fillSelect(f_cashCurrency, CURRENCIES, o => o.code, o => o.name);
  fillSelect(f_feeCurrency, CURRENCIES, o => o.code, o => o.name);

  // Header
  if (formTitle) {
    formTitle.textContent = en.isCashWithdrawal ? 'Edit cash withdrawal' : `Edit ${cat.name}`;
  }

  // Common fields
  if (f_description) f_description.value = en.description || '';
  if (f_date) f_date.value = en.date || todayYYYYMMDD();
  if (f_country) f_country.value = en.country || '';
  if (f_place) f_place.value = en.placeName || '';
  if (f_amount) f_amount.value = (en.amountOriginal ?? '');

  setSelectIfExists(f_currency, en.currency || 'ILS');
  setSelectIfExists(f_paymentMethod, en.paymentMethodId || 'CASH');

  if (f_isRefund) f_isRefund.checked = !!en.isRefund;

  // Multi-day
  if (f_isMultiday) f_isMultiday.checked = !!en.isMultiday;
  if (en.isMultiday) {
    multidayBox?.classList.remove('hidden');
    if (f_duration) f_duration.value = en.duration || 1;
    if (f_endDate) {
      f_endDate.value = en.endDate || addDays(f_date.value, (Number(f_duration.value) || 1) - 1);
    }
  } else {
    multidayBox?.classList.add('hidden');
    if (f_duration) f_duration.value = 1;
    if (f_endDate) f_endDate.value = '';
  }

  if (f_notes) f_notes.value = en.notes || '';

  // Withdrawals
  if (en.isCashWithdrawal) {
    withdrawalBox?.classList.remove('hidden');
    setSelectIfExists(f_withdrawalSource, en.withdrawalSourceMethodId || '');
    setSelectIfExists(f_cashWallet, en.withdrawalCashWalletId || '');
    if (f_cashAmount) f_cashAmount.value = en.cashAmount ?? '';
    setSelectIfExists(f_cashCurrency, en.cashCurrency || (en.currency || 'ILS'));
    if (f_feeAmount) f_feeAmount.value = en.feeAmount ?? '';
    setSelectIfExists(f_feeCurrency, en.feeCurrency || 'ILS');
  } else {
    withdrawalBox?.classList.add('hidden');
  }

  lastMainCurrency = toUpperTrim(f_currency?.value);
  openFormModal();
}

/* =========================================================
   15) Save entry (create OR update)
   ========================================================= */
entryForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedCategory) return;

  // 1) Validate core values
  const currency = toUpperTrim(f_currency?.value);
  const amountOriginal = toNumberOrNull(f_amount?.value);
  if (amountOriginal === null) return;

  // 2) Compute FX conversion for display/metrics
  const amountILS = window.fxToILS?.(amountOriginal, currency);

  // 3) Preserve entryId on edit
  const entryId = editingEntryId || uuid();

  // 4) Preserve timestampCreated on edit
  const timestampCreated = editingOriginalTimestampCreated || new Date().toISOString();

  // 5) Build base entry
  const baseEntry = {
    entryId,
    timestampCreated,

    date: f_date?.value,
    categoryId: selectedCategory.id,

    description: f_description?.value.trim() || '',
    country: f_country?.value.trim() || '',
    placeName: f_place?.value.trim() || '',

    currency,
    amountOriginal,
    amountILS,

    paymentMethodId: f_paymentMethod?.value,

    isRefund: !!f_isRefund?.checked,
    isMultiday: !!f_isMultiday?.checked,
    duration: f_isMultiday?.checked ? Math.max(1, Number(f_duration?.value || 1)) : null,
    endDate: f_isMultiday?.checked ? (f_endDate?.value || null) : null,

    notes: f_notes?.value.trim() || '',

    isCashWithdrawal: selectedCategory.id === 'CASH_WITHDRAWAL',

    // Any edit should require re-sync later (stage 2)
    syncStatus: 'pending'
  };

  // 6) If payment is CASH, infer wallet subtype from chosen currency
  if (baseEntry.paymentMethodId === 'CASH') {
    const derived = `CASH_${currency}`;
    baseEntry.cashWalletDerived = CASH_WALLETS.some(w => w.id === derived) ? derived : null;
  }

  // 7) Withdrawal-only fields
  if (selectedCategory.type === 'withdrawal') {
    baseEntry.withdrawalSourceMethodId = f_withdrawalSource?.value || null;
    baseEntry.withdrawalCashWalletId = f_cashWallet?.value || null;

    baseEntry.cashAmount = Number(f_cashAmount?.value || 0) || 0;
    baseEntry.cashCurrency = toUpperTrim(f_cashCurrency?.value) || null;

    baseEntry.feeAmount = Number(f_feeAmount?.value || 0) || 0;
    baseEntry.feeCurrency = toUpperTrim(f_feeCurrency?.value) || null;

    baseEntry.feeILS = window.fxToILS?.(baseEntry.feeAmount, baseEntry.feeCurrency);
    baseEntry.totalILS = (baseEntry.amountILS || 0) + (baseEntry.feeILS || 0);
  }

  // 8) Persist
  await window.dbAddEntry?.(baseEntry);

  // 9) Close + refresh
  closeFormModal();
  setEditMode(null);
  await refreshHome();
});

/* =========================================================
   16) Home rendering (Today + Last entries)
   ========================================================= */
function renderEntries(entries) {
  if (!lastEntriesEl) return;
  lastEntriesEl.innerHTML = '';

  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No entries yet';
    lastEntriesEl.appendChild(li);
    return;
  }

  entries.forEach(en => {
    const cat = CATEGORIES.find(c => c.id === en.categoryId);
    const pm = PAYMENT_METHODS.find(p => p.id === en.paymentMethodId);

    const li = document.createElement('li');
    li.style.padding = '10px 0';
    li.style.borderBottom = '1px solid #eee';
    li.style.cursor = 'pointer';

    const ils = Number(en.amountILS || 0);
    const sign = en.isRefund ? '-' : '';

    // ✅ multi-day hint belongs here (en exists here)
    const multidayHint = en.isMultiday ? ` • ${en.duration || 1}d` : '';

    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-weight:600">
            ${en.isCashWithdrawal ? 'Cash Withdrawal' : (cat ? cat.name : en.categoryId)}
          </div>
          <div style="font-size:12px;color:#666">
            ${en.date}${multidayHint} • ${pm ? pm.name : ''} • ${en.country || ''}
          </div>
        </div>
        <div style="font-weight:700">
          ${
            en.isCashWithdrawal
              ? `₪ ${(Number(en.feeILS || 0)).toFixed(0)} fee`
              : `${sign}₪ ${ils.toFixed(0)}`
          }
        </div>
      </div>
    `;

    li.addEventListener('click', () => openEditEntry(en.entryId));
    lastEntriesEl.appendChild(li);
  });
}


async function refreshHome() {
  const today = todayYYYYMMDD();

  // Get all entries once (small dataset — fine for stage 1)
  const all = await window.dbGetAllEntries?.() || [];

  // Correct Today spend (supports multi-day spreading)
  const sumToday = calcSpendILSForDate(all, today);
  if (todayValueEl) todayValueEl.textContent = `₪ ${Math.round(sumToday)}`;

  // Keep last entries list as before (recent by created timestamp)
  const recent = await window.dbListRecent?.(10, { includeWithdrawals: true });
  renderEntries(recent || []);
}


/* =========================================================
   17) Settings: FX table + online check
   ========================================================= */

// Status message inside Settings (FX area)
function setFxNote(msg) {
  if (s_fxNote) s_fxNote.textContent = msg || '—';
}

// Use currencies list as the source of truth for what to display
function fxRateKeysFromCurrencies() {
  return (window.CURRENCIES || [])
    .map(c => String(c.code || '').toUpperCase())
    .filter(Boolean);
}

// Render editable FX table
async function renderFxTable() {
  if (!fxTable) return;

  const codes = fxRateKeysFromCurrencies();
  const fx = window.FX || { base: 'ILS', ratesToILS: {} };
  const rates = fx.ratesToILS || {};

  fxTable.innerHTML = `
    <thead>
      <tr>
        <th>Currency</th>
        <th>1 unit → ILS</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = fxTable.querySelector('tbody');

  codes.forEach(code => {
    const tr = document.createElement('tr');

    const tdCode = document.createElement('td');
    tdCode.textContent = code;

    const tdRate = document.createElement('td');
    const input = document.createElement('input');

    input.className = 'fx-rate-input';
    input.type = 'number';
    input.step = '0.0000001';
    input.inputMode = 'decimal';

    const val = rates[code];
    input.value = (typeof val === 'number' && Number.isFinite(val)) ? String(val) : '';

    // Keep ILS fixed at 1
    if (code === 'ILS') {
      input.value = '1';
      input.disabled = true;
    } else {
      // Manual edit → persist into IndexedDB via fxSave()
      input.addEventListener('change', async () => {
        const n = Number(input.value);
        if (!Number.isFinite(n) || n <= 0) {
          alert('Please enter a valid positive number.');
          input.value = (typeof rates[code] === 'number') ? String(rates[code]) : '';
          return;
        }

        // Update in-memory
        window.FX.ratesToILS[code] = n;
        window.FX.updatedAt = new Date().toISOString();

        // Persist to IndexedDB (fx.js)
        if (window.fxSave) await window.fxSave();

        await refreshSettingsUI();
        setFxNote('Saved locally.');
      });
    }

    tdRate.appendChild(input);
    tr.appendChild(tdCode);
    tr.appendChild(tdRate);
    tbody.appendChild(tr);
  });
}


// ===========================
// Settings: Check & update FX online
// ===========================
btnCheckFx?.addEventListener('click', async () => {
  if (!navigator.onLine) {
    alert('You are offline.');
    return;
  }

  // If opened as a local file, many APIs block requests (CORS/null origin)
  if (location.protocol === 'file:') {
    setFxNote('Online FX check may be blocked in file mode. Use manual edits, or run via a hosted link / local server.');
    alert('Online FX check may not work when the app is opened as a local file (file://).');
    return;
  }


  if (btnCheckFx) btnCheckFx.disabled = true;

  try {
    setFxNote('Checking live rates…');

    const url = 'https://api.frankfurter.app/latest?from=ILS';
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}. Body: ${t.slice(0, 120)}`);
    }

    const data = await res.json();

    // Expected: { rates: { USD: 0.27, EUR: 0.24, ... } }
    if (!data?.rates || typeof data.rates !== 'object') {
      throw new Error('Unexpected response format (missing "rates").');
    }

    // Convert API (1 ILS -> X CUR) to our model (1 CUR -> ILS)
    const codes = fxRateKeysFromCurrencies();
    const newRatesToILS = { ...(window.FX?.ratesToILS || {}) };
    newRatesToILS.ILS = 1;

    const diffs = [];
    for (const code of codes) {
      if (code === 'ILS') continue;

      const ilsToCur = Number(data.rates[code]);
      if (!Number.isFinite(ilsToCur) || ilsToCur <= 0) continue;

      const curToIls = 1 / ilsToCur;
      const old = Number(newRatesToILS[code]);

      const diffPct = Number.isFinite(old) && old > 0 ? Math.abs(curToIls - old) / old : 1;
      if (diffPct >= 0.003) diffs.push({ code, old, curToIls });
    }

    if (!diffs.length) {
      setFxNote('Live rates match your saved rates (no update needed).');
      return;
    }

    const ok = confirm(
      `Found differences in ${diffs.length} currencies.\n\n` +
      diffs.slice(0, 8).map(d => `${d.code}: ${d.old || '—'} → ${d.curToIls}`).join('\n') +
      (diffs.length > 8 ? `\n…and ${diffs.length - 8} more.` : '') +
      `\n\nUpdate your saved rates?`
    );

    if (!ok) {
      setFxNote('No changes applied.');
      return;
    }

    diffs.forEach(d => { newRatesToILS[d.code] = d.curToIls; });

    window.FX = window.FX || { base: 'ILS', ratesToILS: {}, updatedAt: null };
    window.FX.base = 'ILS';
    window.FX.ratesToILS = newRatesToILS;
    window.FX.updatedAt = new Date().toISOString();

    if (window.fxSave) await window.fxSave();

    await refreshSettingsUI();
    setFxNote('Updated from live rates.');
  } catch (err) {
    console.error(err);
    setFxNote('Update failed.');
    alert(`FX update failed: ${err?.message || String(err)}`);
  } finally {
    if (btnCheckFx) btnCheckFx.disabled = false;
  }
});



/* =========================================================
   18) Settings: open/close + render values
   ========================================================= */
async function refreshSettingsUI() {
  // Last sync (placeholder for Stage 2)
  const lastSync = await window.dbGetSetting?.('lastSyncAt');
  if (s_lastSync) s_lastSync.textContent = fmtDateTime(lastSync);

  // FX updated time
  const fx = await window.dbGetSetting?.('fx');
  const fxUpdatedAt = fx?.updatedAt || null;
  if (s_fxUpdated) s_fxUpdated.textContent = fxUpdatedAt ? fmtDateTime(fxUpdatedAt) : 'Default (not updated yet)';

  // Version
  if (s_version) s_version.textContent = APP_VERSION;

  // Online button state
  if (btnCheckFx) btnCheckFx.disabled = !navigator.onLine;
  setFxNote(navigator.onLine ? 'Online: you can check live rates.' : 'Offline: edits are local only.');

  // FX table
  await renderFxTable();
}

/* =========================================================
   19) Export / Import (upgrade path)
   ========================================================= */
async function doExport() {
  const entries = await window.dbGetAllEntries?.();
  const fx = await window.dbGetSetting?.('fx');
  const lastSyncAt = await window.dbGetSetting?.('lastSyncAt');

  const payload = {
    schema: 'financial_travel_app_export_v1',
    exportedAt: new Date().toISOString(),
    entries: entries || [],
    settings: { fx, lastSyncAt }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `EllaBigTrip_export_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function doImportFromFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data || !Array.isArray(data.entries)) {
    alert('Invalid import file (missing entries).');
    return;
  }

  // Import entries (put() = upsert)
  for (const en of data.entries) {
    if (!en || !en.entryId || !en.date || !en.categoryId) continue;
    await window.dbAddEntry?.(en);
  }

  // Import settings
  if (data.settings?.fx && window.dbSetSetting) {
    await window.dbSetSetting('fx', data.settings.fx);
    window.FX = data.settings.fx; // reflect in-memory
    if (window.fxInit) await window.fxInit();
  }
  if (data.settings && 'lastSyncAt' in data.settings && window.dbSetSetting) {
    await window.dbSetSetting('lastSyncAt', data.settings.lastSyncAt);
  }

  await refreshHome();
  await refreshSettingsUI();

  alert('Import completed.');
}

/* =========================================================
   20) Restore defaults / Reset local DB
   ========================================================= */
async function restoreDefaults() {
  const ok = confirm(
    'Restore defaults?\n\nThis will reset:\n• FX rates (to default)\n• Last online sync (to empty)\n\nIt will NOT delete entries.'
  );
  if (!ok) return;

  // Prefer fx.js helper if you created it
  if (window.fxRestoreDefaults) {
    await window.fxRestoreDefaults();
  } else if (window.dbSetSetting && window.DEFAULT_FX) {
    window.FX = JSON.parse(JSON.stringify(window.DEFAULT_FX));
    window.FX.updatedAt = null;
    await window.dbSetSetting('fx', window.FX);
  } else {
    // Worst-case: keep current FX but clear updatedAt
    if (window.dbSetSetting) {
      window.FX.updatedAt = null;
      await window.dbSetSetting('fx', window.FX);
    }
  }

  if (window.dbSetSetting) {
    await window.dbSetSetting('lastSyncAt', null);
  }

  await refreshSettingsUI();
  alert('Defaults restored.');
}

async function resetAllLocalData() {
  const ok1 = confirm(
    'Reset ALL local data?\n\nThis will permanently delete:\n• All entries\n• FX settings\n• Sync status\n\nThis cannot be undone.'
  );
  if (!ok1) return;

  const ok2 = prompt('Type RESET to confirm:');
  if (ok2 !== 'RESET') {
    alert('Cancelled.');
    return;
  }

  const req = indexedDB.deleteDatabase('financial_travel_app');

  req.onsuccess = () => {
    alert('Local data reset. Reloading…');
    location.reload();
  };

  req.onerror = () => {
    alert('Failed to reset local data.');
  };

  req.onblocked = () => {
    alert('Reset blocked. Close other tabs of this app and try again.');
  };
}

/* =========================================================
   21) Event wiring (buttons / clicks)
   ========================================================= */
// Main
fab?.addEventListener('click', openCategoryModal);
closeCategoryModalBtn?.addEventListener('click', closeCategoryModal);

// Form modal controls
closeFormModalBtn?.addEventListener('click', () => {
  closeFormModal();
  setEditMode(null);
});

cancelBtn?.addEventListener('click', () => {
  closeFormModal();
  setEditMode(null);
});

// Delete entry (only in edit mode)
deleteBtn?.addEventListener('click', async () => {
  if (!editingEntryId) return;
  const ok = confirm('Delete this entry?');
  if (!ok) return;

  await window.dbDeleteEntry?.(editingEntryId);
  closeFormModal();
  setEditMode(null);
  await refreshHome();
});

// Settings modal controls
settingsBtn?.addEventListener('click', async () => {
  await refreshSettingsUI();
  const content = settingsModal?.querySelector('.modal-content');
  if (content) content.scrollTop = 0;
  openModal(settingsModal);
});

closeSettingsModalBtn?.addEventListener('click', () => closeModal(settingsModal));

// Settings: Export / Import
btnExport?.addEventListener('click', doExport);

btnImport?.addEventListener('click', () => importFile?.click());

importFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    await doImportFromFile(file);
  } catch (err) {
    alert(`Import failed: ${err?.message || String(err)}`);
  } finally {
    // Allow importing the same file again
    e.target.value = '';
  }
});

// Settings: Defaults / Reset
btnRestoreDefaults?.addEventListener('click', restoreDefaults);
btnResetLocal?.addEventListener('click', resetAllLocalData);


// Connectivity changes → refresh settings text/button state if modal is open
window.addEventListener('online', async () => {
  if (!settingsModal?.classList.contains('hidden')) await refreshSettingsUI();
});
window.addEventListener('offline', async () => {
  if (!settingsModal?.classList.contains('hidden')) await refreshSettingsUI();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  });
}

/* ===========================
   22) PWA update handling: Service worker + update UX
   =========================== */
const updateBanner = document.getElementById('updateBanner');
const btnReload = document.getElementById('btnReload');

let swRegistration = null;

function showUpdateBanner() {
  updateBanner?.classList.remove('hidden');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      swRegistration = await navigator.serviceWorker.register('./service-worker.js');

      // If there’s already a waiting worker (update ready)
      if (swRegistration.waiting) showUpdateBanner();

      // When a new worker is found, watch for it to become "installed"
      swRegistration.addEventListener('updatefound', () => {
        const newWorker = swRegistration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // "installed" + we already have a controller => update available
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      // When SW takes over, reload once to use new assets
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

    } catch (e) {
      console.error('SW registration failed', e);
    }
  });
}

btnReload?.addEventListener('click', async () => {
  if (!swRegistration) return;

  // Tell waiting SW to activate now
  if (swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    // fallback
    window.location.reload();
  }
});


/* =========================================================
   23) Init
   ========================================================= */
(async () => {
  // Build static UI
  renderCategories();

  // Ensure modals start closed
  closeModal(categoryModal);
  closeModal(formModal);
  closeModal(settingsModal);

  // Clear edit state
  setEditMode(null);

  // Load FX from IndexedDB (fx.js)
  if (window.fxInit) await window.fxInit();

  // Render home
  await refreshHome();
})();
