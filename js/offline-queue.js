/**
 * ============================================================================
 * INDEXEDDB OFFLINE QUEUE FOR STAFF SCANNER (`public/js/offline-queue.js`)
 * Queues scanned QR tokens when tablet Wi-Fi / 4G drops and replays them
 * automatically when connectivity returns.
 * ============================================================================
 */

window.OfflineQueue = {
  dbName: "MwaSeminarCheckinOfflineDB",
  storeName: "pending_scans",
  dbVersion: 1,
  isSyncing: false,
  listeners: [],

  /**
   * Opens or upgrades the IndexedDB database
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "queue_id",
            autoIncrement: true,
          });
          store.createIndex("target_qr_token", "target_qr_token", {
            unique: false,
          });
          store.createIndex("scanned_at", "scanned_at", { unique: false });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Registers a callback for queue count changes: `fn(count, syncingStatus)`
   */
  onChange(callback) {
    if (typeof callback === "function") {
      this.listeners.push(callback);
    }
  },

  async notifyListeners() {
    const items = await this.getAll();
    for (const cb of this.listeners) {
      try {
        cb(items.length, this.isSyncing, items);
      } catch (e) {
        console.error("[OfflineQueue] Listener error:", e);
      }
    }
  },

  /**
   * Enqueues a scanned E-Ticket QR token into IndexedDB
   */
  async enqueue({ target_qr_token, action_type = "CHECKIN" }) {
    const db = await this.openDB();
    const record = {
      target_qr_token: String(target_qr_token || "").trim(),
      action_type,
      mode: "STAFF",
      scanned_at: new Date().toISOString(),
      retry_count: 0,
      last_error: null,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.add(record);

      req.onsuccess = async () => {
        record.queue_id = req.result;
        await this.notifyListeners();
        resolve(record);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Returns all queued scan records sorted by queue_id
   */
  async getAll() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Removes a synced record by its queue_id
   */
  async remove(queueId) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.delete(queueId);

      req.onsuccess = async () => {
        await this.notifyListeners();
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Clears all records in the offline queue
   */
  async clearAll() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.clear();

      req.onsuccess = async () => {
        await this.notifyListeners();
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Automatically replays queued check-in/out records to Supabase Edge Function `checkin`
   * when connectivity returns.
   */
  async syncAll(getIdTokenFn, onRecordSyncedCallback) {
    if (this.isSyncing) return { synced: 0, failed: 0 };
    if (!navigator.onLine) return { synced: 0, failed: 0 };

    const items = await this.getAll();
    if (items.length === 0) return { synced: 0, failed: 0 };

    this.isSyncing = true;
    await this.notifyListeners();

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      if (!navigator.onLine) break;
      try {
        const idToken =
          typeof getIdTokenFn === "function"
            ? getIdTokenFn()
            : window.LiffHelper?.getIdToken();

        const result = await window.invokeEdgeFunction("checkin", {
          idToken,
          mode: "STAFF",
          action_type: item.action_type || "CHECKIN",
          target_qr_token: item.target_qr_token,
          scanned_at: item.scanned_at,
        });

        await this.remove(item.queue_id);
        synced++;
        if (typeof onRecordSyncedCallback === "function") {
          onRecordSyncedCallback(item, result, null);
        }
      } catch (err) {
        // If error is 404 (invalid QR) or 400, remove from queue so it doesn't block forever
        if (err.status === 404 || err.status === 400) {
          await this.remove(item.queue_id);
          if (typeof onRecordSyncedCallback === "function") {
            onRecordSyncedCallback(item, null, err);
          }
        } else {
          failed++;
        }
      }
    }

    this.isSyncing = false;
    await this.notifyListeners();
    return { synced, failed };
  },

  /**
   * Initializes automatic `online` event listener and periodic background sync check
   */
  initAutoSync(getIdTokenFn, onRecordSyncedCallback) {
    window.addEventListener("online", () => {
      this.syncAll(getIdTokenFn, onRecordSyncedCallback);
    });

    // Also attempt background flush every 15 seconds if online and queue > 0
    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncAll(getIdTokenFn, onRecordSyncedCallback);
      }
    }, 15000);

    this.notifyListeners();
  },
};
