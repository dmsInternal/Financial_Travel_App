// db.js
// Minimal IndexedDB wrapper (safe + readable)

const DB_NAME = 'financial_travel_app';
const DB_VERSION = 2;

const STORE_ENTRIES = 'entries';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
    const db = req.result;

    // settings store (for FX, app settings, etc.)
    const STORE_SETTINGS = 'settings';
    if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
    }

    // entries store
    if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'entryId' });
        store.createIndex('byDate', 'date');
        store.createIndex('byCreated', 'timestampCreated');
    }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

window.dbAddEntry = async function dbAddEntry(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readwrite');
    tx.objectStore(STORE_ENTRIES).put(entry);

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};

window.dbListRecent = async function dbListRecent(limit = 10, opts = {}) {
  const {
    includeWithdrawals = true
  } = opts;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readonly');
    const store = tx.objectStore(STORE_ENTRIES);
    const idx = store.index('byCreated');

    const results = [];
    idx.openCursor(null, 'prev').onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return; // finish in tx.oncomplete

      const v = cursor.value;

      // Filter withdrawals if requested
      if (!includeWithdrawals && v.isCashWithdrawal) {
        cursor.continue();
        return;
      }

      results.push(v);

      if (results.length >= limit) {
        // Stop early; transaction will complete soon
        return;
      }

      cursor.continue();
    };

    tx.oncomplete = () => {
      db.close();
      resolve(results);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};


window.dbSumILSForDate = async function dbSumILSForDate(yyyyMmDd) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readonly');
    const store = tx.objectStore(STORE_ENTRIES);

    let sum = 0;

    // We scan all entries (simple + reliable for Stage 1).
    // If this ever becomes slow, we can optimize later with indexes and ranges.
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return; // finish in tx.oncomplete

      const v = cursor.value;

      // Withdrawals are not "spend" (count only fee)
      if (v.isCashWithdrawal) {
        // Count fee on the withdrawal date only
        if (v.date === yyyyMmDd) sum += Number(v.feeILS || 0);
        cursor.continue();
        return;
      }

      const sign = v.isRefund ? -1 : 1;

      // Only count if we have a valid ILS value
      if (v.amountILS === null || v.amountILS === undefined) {
        cursor.continue();
        return;
      }

      // ✅ Multi-day handling (spread amount across days)
      if (v.isMultiday && v.endDate) {
        const dur = Math.max(1, Number(v.duration || 1));
        const start = new Date(v.date);
        const end = new Date(v.endDate);
        const target = new Date(yyyyMmDd);

        // Normalize time (avoid timezone edge bugs)
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        target.setHours(0,0,0,0);

        // If target date is within [start..end], count pro-rated amount
        if (target >= start && target <= end) {
          const perDay = Number(v.amountILS) / dur;
          sum += sign * perDay;
        }
      } else {
        // Normal single-day spend
        if (v.date === yyyyMmDd) sum += sign * Number(v.amountILS);
      }

      cursor.continue();
    };

    tx.oncomplete = () => {
      db.close();
      resolve(Number(sum.toFixed(2)));
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};


window.dbSetSetting = async function dbSetSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

window.dbGetSetting = async function dbGetSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get(key);

    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => db.close();
  });
};

window.dbGetEntry = async function dbGetEntry(entryId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const req = tx.objectStore('entries').get(entryId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

window.dbDeleteEntry = async function dbDeleteEntry(entryId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').delete(entryId);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

window.dbGetAllEntries = async function dbGetAllEntries() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readonly');
    const req = tx.objectStore('entries').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};
