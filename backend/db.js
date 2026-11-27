const path = require('path');
const fs = require('fs');
const {
  getMongoClient,
  getMongoDb,
  withMongoTransaction,
  stripMongoId,
  stripMongoIds,
  escapeRegex,
  getMongoStatus
} = require('./mongo');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

let sqliteDb = null;

/**
 * Legacy SQLite reader helper (used only for one-time migration or local read fallback).
 */
function getLegacySQLiteDb() {
  if (sqliteDb) return sqliteDb;
  try {
    const dbPath = path.join(process.env.MARTGPT_DATA_DIR || path.join(__dirname, 'data'), 'kirana.db');
    if (!fs.existsSync(dbPath)) return null;
    const { DatabaseSync } = require('node:sqlite');
    sqliteDb = new DatabaseSync(dbPath, { readOnly: true });
    return sqliteDb;
  } catch (err) {
    console.warn('Legacy SQLite notice:', err.message);
    return null;
  }
}

const pool = {
  async testConnection() {
    console.log('⚡ Initializing MongoDB Atlas connection...');
    try {
      const db = await getMongoDb();
      await db.command({ ping: 1 });
      const status = getMongoStatus();
      console.log(`✅ Connected to MongoDB Atlas database "${status.dbName}" (${status.host})`);
      return true;
    } catch (err) {
      console.error('❌ MongoDB Atlas connection error:', err.message);
      throw err;
    }
  },

  async ensureConnected() {
    return getMongoDb();
  },

  getDb: getMongoDb,
  getClient: getMongoClient,
  withTransaction: withMongoTransaction,
  stripMongoId,
  stripMongoIds,
  escapeRegex,
  getLegacySQLiteDb,

  getStatus() {
    return getMongoStatus();
  }
};

module.exports = pool;
