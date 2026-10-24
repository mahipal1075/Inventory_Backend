// firestore-backup.js
/**
 * READ‑ONLY Firestore backup script
 * --------------------------------
 * Exports all documents from the five collections into JSON files under `../backup/`.
 * Uses Firebase Admin SDK – credentials are taken from the environment variable
 * `GOOGLE_APPLICATION_CREDENTIALS`. The script aborts if the variable is missing.
 *
 * Requirements fulfilled:
 *   • No writes/updates/deletes to Firestore.
 *   • Preserves document IDs and all field data.
 *   • Converts Firestore Timestamp to ISO‑8601 strings.
 *   • Handles large collections via pagination (500 docs per batch).
 *   • Generates backup-summary.json and forecast-data-summary.json.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ---------- 1️⃣ Initialise Firebase Admin ----------
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('[ERROR] GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  process.exit(1);
}
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} catch (e) {
  console.error('[ERROR] Firebase Admin initialisation failed:', e);
  process.exit(1);
}
const db = admin.firestore();

// ---------- 2️⃣ Collections to back up ----------
const collections = [
  'inventory',
  'sales',
  'sales_daily',
  'staffMembers',
  'users',
];

// ---------- 3️⃣ Helper: Firestore value → plain JSON ----------
function convertValue(value) {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __ref__: value.path };
  }
  if (Array.isArray(value)) {
    return value.map(convertValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertValue(v);
    }
    return out;
  }
  return value; // primitive types
}

// ---------- 4️⃣ Export a single collection ----------
async function exportCollection(name, outDir) {
  const colRef = db.collection(name);
  const batchSize = 500; // Firestore max per query
  let lastDoc = null;
  const docs = [];
  let exported = 0;
  let failed = 0;

  while (true) {
    let query = colRef.limit(batchSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      try {
        const raw = doc.data();
        const data = convertValue(raw);
        docs.push({ id: doc.id, data });
        exported++;
      } catch (e) {
        console.warn(`[WARN] Failed to serialize ${name}/${doc.id}:`, e);
        failed++;
      }
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < batchSize) break; // last page
  }

  const filePath = path.join(outDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
  return { name, exported, failed };
}

// ---------- 5️⃣ Forecast‑data validation ----------
function analyzeForecastData({ sales, salesDaily, inventory }) {
  const result = {
    inventoryCount: inventory.length,
    salesCount: sales.length,
    salesDailyCount: salesDaily.length,
    earliestSalesDate: null,
    latestSalesDate: null,
    uniqueProductIdsSales: [],
    uniqueProductIdsSalesDaily: [],
    missingInInventoryFromSales: [],
    missingInInventoryFromSalesDaily: [],
    totalUnitsPerProduct: {},
  };

  const salesProdSet = new Set();
  const dailyProdSet = new Set();
  const inventoryProdSet = new Set();

  // inventory product IDs
  for (const doc of inventory) {
    const pid = doc.data.productId;
    if (pid) inventoryProdSet.add(pid);
  }

  // sales analysis
  for (const doc of sales) {
    const { productId, date, units } = doc.data;
    if (productId) salesProdSet.add(productId);
    if (date) {
      const d = new Date(date);
      if (!result.earliestSalesDate || d < new Date(result.earliestSalesDate)) result.earliestSalesDate = d.toISOString();
      if (!result.latestSalesDate || d > new Date(result.latestSalesDate)) result.latestSalesDate = d.toISOString();
    }
    if (productId && typeof units === 'number') {
      result.totalUnitsPerProduct[productId] = (result.totalUnitsPerProduct[productId] || 0) + units;
    }
  }

  // sales_daily analysis
  for (const doc of salesDaily) {
    const { productId, date, units } = doc.data;
    if (productId) dailyProdSet.add(productId);
    if (date) {
      const d = new Date(date);
      if (!result.earliestSalesDate || d < new Date(result.earliestSalesDate)) result.earliestSalesDate = d.toISOString();
      if (!result.latestSalesDate || d > new Date(result.latestSalesDate)) result.latestSalesDate = d.toISOString();
    }
    if (productId && typeof units === 'number') {
      result.totalUnitsPerProduct[productId] = (result.totalUnitsPerProduct[productId] || 0) + units;
    }
  }

  result.uniqueProductIdsSales = Array.from(salesProdSet);
  result.uniqueProductIdsSalesDaily = Array.from(dailyProdSet);
  result.missingInInventoryFromSales = result.uniqueProductIdsSales.filter(p => !inventoryProdSet.has(p));
  result.missingInInventoryFromSalesDaily = result.uniqueProductIdsSalesDaily.filter(p => !inventoryProdSet.has(p));

  return result;
}

// ---------- 6️⃣ Main driver ----------
(async () => {
  const outDir = path.resolve(__dirname, '../../backup');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const backupSummary = {
    backupDate: new Date().toISOString(),
    collections: [],
    totalDocuments: 0,
    totalFailed: 0,
    status: 'success',
  };

  console.log('🔥 Starting Firestore backup …');

  for (const coll of collections) {
    try {
      const { exported, failed } = await exportCollection(coll, outDir);
      console.log(`✅ ${coll}: ${exported} docs (failed: ${failed})`);
      backupSummary.collections.push({ name: coll, exported, failed });
      backupSummary.totalDocuments += exported;
      backupSummary.totalFailed += failed;
    } catch (e) {
      console.error(`[ERROR] Collection ${coll} backup failed:`, e);
      backupSummary.collections.push({ name: coll, exported: 0, failed: 0, error: e.message });
      backupSummary.status = 'partial_failure';
    }
  }

  // write backup-summary.json
  fs.writeFileSync(path.join(outDir, 'backup-summary.json'), JSON.stringify(backupSummary, null, 2));

  // ----- Forecast data validation -----
  const sales = JSON.parse(fs.readFileSync(path.join(outDir, 'sales.json')));
  const salesDaily = JSON.parse(fs.readFileSync(path.join(outDir, 'sales_daily.json')));
  const inventory = JSON.parse(fs.readFileSync(path.join(outDir, 'inventory.json')));
  const forecast = analyzeForecastData({ sales, salesDaily, inventory });
  fs.writeFileSync(path.join(outDir, 'forecast-data-summary.json'), JSON.stringify(forecast, null, 2));

  console.log('\n=== Firestore Backup Completed ===');
  console.log(`Total documents exported: ${backupSummary.totalDocuments}`);
  console.log(`Failed documents: ${backupSummary.totalFailed}`);
  console.log(`Backup location: ${outDir}`);

  console.log('\n=== Forecast‑data validation ===');
  console.log(`Earliest sales date: ${forecast.earliestSalesDate}`);
  console.log(`Latest sales date: ${forecast.latestSalesDate}`);
  console.log(`Unique product IDs in sales: ${forecast.uniqueProductIdsSales.length}`);
  console.log(`Unique product IDs in sales_daily: ${forecast.uniqueProductIdsSalesDaily.length}`);
  console.log(`Products in sales missing from inventory: ${forecast.missingInInventoryFromSales.length}`);
  console.log(`Products in sales_daily missing from inventory: ${forecast.missingInInventoryFromSalesDaily.length}`);
})();
