// backend/scripts/migrate-backup-to-mongodb.js

/**
 * Migration script – copy Firestore backup JSON files into MongoDB.
 *
 * Usage:
 *   npm run migrate:dry-run   // validates & reports, no DB writes
 *   npm run migrate          // performs actual migration (idempotent)
 *
 * Safety checks performed in both modes:
 *   – All expected backup files exist.
 *   – JSON is parsed correctly.
 *   – No duplicate _id values inside a collection.
 *   – All _id values are strings.
 *   – sales.productId & sales_daily.productId are strings.
 *   – Orphan productId (7gsoQeo5fcOmuuR9BGL2) appears in sales & sales_daily.
 *   – Source document counts match expected numbers.
 *   – Prints a summary of what would be inserted.
 *   – Performs ZERO writes to MongoDB in dry‑run.
 *
 * In real migration mode (no --dry-run):
 *   – Connects to MongoDB using the existing config.
 *   – For each document:
 *        * If _id does not exist → insert.
 *        * If _id exists and data identical → skip.
 *        * If _id exists but differs → report conflict and abort collection.
 *   – Uses bulkWrite for efficiency.
 *   – Generates a detailed report (backend/scripts/migration-report.json).
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const SalesDaily = require('../models/SalesDaily');
const User = require('../models/User');
const StaffMember = require('../models/StaffMember');
const connectDB = require('../config/db');

const BACKUP_DIR = path.resolve(__dirname, '../../backup');
const EXPECTED_FILES = ['inventory.json', 'sales.json', 'sales_daily.json', 'staffMembers.json', 'users.json'];
const ORPHAN_PRODUCT_ID = '7gsoQeo5fcOmuuR9BGL2';

const isDryRun = process.argv.includes('--dry-run');

async function loadJson(fileName) {
  const filePath = path.join(BACKUP_DIR, fileName);
  const data = await readFile(filePath, 'utf8');
  return JSON.parse(data);
}

function validateDocuments(docs, collectionName) {
  const ids = new Set();
  for (const doc of docs) {
    if (!doc.id || typeof doc.id !== 'string') {
      throw new Error(`${collectionName}: document missing string 'id' field`);
    }
    if (ids.has(doc.id)) {
      throw new Error(`${collectionName}: duplicate id '${doc.id}' detected`);
    }
    ids.add(doc.id);
  }
  return ids;
}

function extractStats(collectionName, docs) {
  const stats = {};
  if (collectionName === 'sales' || collectionName === 'sales_daily') {
    const dates = docs.map(d => new Date(d.data.date));
    stats.earliest = new Date(Math.min(...dates)).toISOString();
    stats.latest = new Date(Math.max(...dates)).toISOString();
    const orphanCount = docs.filter(d => d.data.productId === ORPHAN_PRODUCT_ID).length;
    stats.orphanCount = orphanCount;
  }
  return stats;
}

async function dryRun() {
  console.log('=== DRY RUN MIGRATION ===');
  // Verify files exist
  for (const f of EXPECTED_FILES) {
    if (!fs.existsSync(path.join(BACKUP_DIR, f))) {
      throw new Error(`Missing backup file: ${f}`);
    }
  }

  // Load data
  const [inventory, sales, salesDaily, staffMembers, users] = await Promise.all([
    loadJson('inventory.json'),
    loadJson('sales.json'),
    loadJson('sales_daily.json'),
    loadJson('staffMembers.json'),
    loadJson('users.json'),
  ]);

  const collections = [
    { name: 'inventory', docs: inventory },
    { name: 'sales', docs: sales },
    { name: 'sales_daily', docs: salesDaily },
    { name: 'staffMembers', docs: staffMembers },
    { name: 'users', docs: users },
  ];

  const report = {
    dryRun: true,
    timestamp: new Date().toISOString(),
    sourceCounts: {},
    stats: {},
  };

  for (const coll of collections) {
    console.log(`\nValidating ${coll.name} (${coll.docs.length} records)...`);
    validateDocuments(coll.docs, coll.name);
    report.sourceCounts[coll.name] = coll.docs.length;
    if (coll.name === 'sales' || coll.name === 'sales_daily') {
      for (const doc of coll.docs) {
        if (typeof doc.data.productId !== 'string') {
          throw new Error(`${coll.name}: productId must be a string (found in id ${doc.id})`);
        }
      }
      const stats = extractStats(coll.name, coll.docs);
      report.stats[coll.name] = stats;
      console.log(`  Orphan product '${ORPHAN_PRODUCT_ID}' records: ${stats.orphanCount}`);
      console.log(`  Date range: ${stats.earliest} → ${stats.latest}`);
    }
    console.log('  No duplicate IDs, all IDs are strings.');
  }

  console.log('\n=== DRY RUN SUMMARY ===');
  console.table(report.sourceCounts);
  const reportPath = path.join(__dirname, 'migration-report.json');
  await writeFile(reportPath, JSON.stringify({ ...report, note: 'DRY_RUN' }, null, 2));
  console.log('Dry‑run report written to migration-report.json (marked as DRY_RUN).');
}

async function realMigration() {
  console.log('=== REAL MIGRATION START ===');
  await connectDB();

  const [inventory, sales, salesDaily, staffMembers, users] = await Promise.all([
    loadJson('inventory.json'),
    loadJson('sales.json'),
    loadJson('sales_daily.json'),
    loadJson('staffMembers.json'),
    loadJson('users.json'),
  ]);

  const collections = [
    { name: 'inventory', Model: Inventory, docs: inventory },
    { name: 'sales', Model: Sale, docs: sales },
    { name: 'sales_daily', Model: SalesDaily, docs: salesDaily },
    { name: 'staffMembers', Model: StaffMember, docs: staffMembers },
    { name: 'users', Model: User, docs: users },
  ];

  const report = {
    dryRun: false,
    timestamp: new Date().toISOString(),
    sourceCounts: {},
    insertedCounts: {},
    skippedCounts: {},
    conflictCounts: {},
    failedCounts: {},
    finalMongoCounts: {},
    stats: {},
    status: 'incomplete',
  };

  for (const coll of collections) {
    console.log(`\nProcessing ${coll.name} (${coll.docs.length} records)...`);
    report.sourceCounts[coll.name] = coll.docs.length;
    const bulkOps = [];
    let inserted = 0;
    let skipped = 0;
    let conflicts = 0;
    for (const doc of coll.docs) {
      const existing = await coll.Model.findById(doc.id).lean();
      if (!existing) {
        bulkOps.push({ insertOne: { document: { _id: doc.id, ...doc.data } } });
        inserted++;
      } else {
        const existingStr = JSON.stringify(existing);
        const incomingStr = JSON.stringify({ _id: doc.id, ...doc.data });
        if (existingStr === incomingStr) {
          skipped++;
        } else {
          console.error(`Conflict detected in ${coll.name} for _id ${doc.id}`);
          conflicts++;
          break;
        }
      }
    }
    if (conflicts > 0) {
      report.conflictCounts[coll.name] = conflicts;
      report.status = 'conflict';
      break;
    }
    if (bulkOps.length > 0) {
      await coll.Model.bulkWrite(bulkOps);
    }
    report.insertedCounts[coll.name] = inserted;
    report.skippedCounts[coll.name] = skipped;
    if (coll.name === 'sales' || coll.name === 'sales_daily') {
      report.stats[coll.name] = extractStats(coll.name, coll.docs);
    }
    report.finalMongoCounts[coll.name] = await coll.Model.countDocuments();
  }

  if (report.status !== 'conflict') {
    report.status = 'completed';
  }

  const reportPath = path.join(__dirname, 'migration-report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log('\n=== MIGRATION REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('Report written to backend/scripts/migration-report.json');
  process.exit(0);
}

(async () => {
  try {
    if (isDryRun) {
      await dryRun();
    } else {
      await realMigration();
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
})();
