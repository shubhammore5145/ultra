const { MongoClient } = require('mongodb');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const DEFAULT_DB_NAME = process.env.MONGODB_DB_NAME || 'martgpt';
const MONGODB_URI = process.env.MONGODB_URI || '';

let indexesInitialized = false;
let lastMongoError = null;
let mongoReady = false;

/**
 * Resolve MongoDB URI dynamically (supports runtime env vars on Vercel/Render).
 */
function getMongoUri() {
  return process.env.MONGODB_URI || MONGODB_URI;
}

/**
 * Ensures a single shared MongoClient promise across warm serverless invocations and Express.
 */
async function getMongoClient() {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not configured.');
  }

  if (global.__martgptMongoClient && global.__martgptMongoReady) {
    return global.__martgptMongoClient;
  }

  if (!global.__martgptMongoPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    global.__martgptMongoPromise = client
      .connect()
      .then(async (connectedClient) => {
        global.__martgptMongoClient = connectedClient;
        global.__martgptMongoReady = true;
        mongoReady = true;
        lastMongoError = null;
        return connectedClient;
      })
      .catch((err) => {
        global.__martgptMongoPromise = null;
        global.__martgptMongoReady = false;
        mongoReady = false;
        lastMongoError = err.message;
        throw err;
      });
  }

  return global.__martgptMongoPromise;
}

/**
 * Returns connected MongoDB Db instance and ensures indexes once.
 */
async function getMongoDb() {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME;
  const db = client.db(dbName);

  if (!indexesInitialized) {
    indexesInitialized = true;
    ensureIndexes(db).catch((err) => {
      console.warn('MongoDB index setup notice:', err.message);
    });
  }

  return db;
}

async function ensureIndexes(db) {
  await Promise.allSettled([
    db.collection('shops').createIndex({ shopId: 1 }, { unique: true }),
    db.collection('users').createIndex({ uid: 1 }, { unique: true }),
    db.collection('users').createIndex({ email: 1 }),
    db.collection('users').createIndex({ shopId: 1 }),
    db.collection('products').createIndex({ id: 1 }, { unique: true }),
    db.collection('products').createIndex({ shopId: 1, isDeleted: 1 }),
    db.collection('products').createIndex({ shopId: 1, barcode: 1 }),
    db.collection('customers').createIndex({ id: 1 }, { unique: true }),
    db.collection('customers').createIndex({ shopId: 1, isDeleted: 1 }),
    db.collection('transactions').createIndex({ id: 1 }, { unique: true }),
    db.collection('transactions').createIndex({ shopId: 1, createdAt: -1 }),
    db.collection('expenses').createIndex({ id: 1 }, { unique: true }),
    db.collection('expenses').createIndex({ shopId: 1, date: -1 }),
    db.collection('udhar_transactions').createIndex({ id: 1 }, { unique: true }),
    db.collection('udhar_transactions').createIndex({ shopId: 1, createdAt: -1 }),
    db.collection('udhar_transactions').createIndex({ customerId: 1 }),
    db.collection('suppliers').createIndex({ id: 1 }, { unique: true }),
    db.collection('suppliers').createIndex({ shopId: 1 }),
    db.collection('purchases').createIndex({ id: 1 }, { unique: true }),
    db.collection('purchases').createIndex({ shopId: 1, date: -1 }),
    db.collection('notifications').createIndex({ id: 1 }, { unique: true }),
    db.collection('notifications').createIndex({ shopId: 1, createdAt: -1 }),
    db.collection('promo_codes').createIndex({ code: 1 }, { unique: true }),
    db.collection('staff').createIndex({ id: 1 }, { unique: true }),
    db.collection('staff').createIndex({ shopId: 1 }),
    db.collection('staff_attendance').createIndex({ id: 1 }, { unique: true }),
    db.collection('staff_attendance').createIndex({ shopId: 1, staffId: 1, date: 1 }),
    db.collection('staff_salary_payments').createIndex({ id: 1 }, { unique: true }),
    db.collection('staff_salary_payments').createIndex({ shopId: 1, paymentDate: -1 })
  ]);
}

/**
 * Executes an operation inside a MongoDB Atlas replica-set transaction.
 */
async function withMongoTransaction(fn) {
  const client = await getMongoClient();
  const db = await getMongoDb();
  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(db, session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function stripMongoId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function stripMongoIds(docs) {
  return Array.isArray(docs) ? docs.map(stripMongoId) : [];
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMongoStatus() {
  const uri = getMongoUri();
  let host = '';
  try {
    const match = uri.match(/@([^/?]+)/);
    host = match ? match[1] : '';
  } catch {}
  return {
    adapter: mongoReady || global.__martgptMongoReady ? 'mongodb_atlas' : 'mongodb_connecting',
    isMongoReady: Boolean(mongoReady || global.__martgptMongoReady),
    dbName: process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME,
    host,
    configured: Boolean(uri),
    lastError: lastMongoError
  };
}

module.exports = {
  getMongoClient,
  getMongoDb,
  withMongoTransaction,
  stripMongoId,
  stripMongoIds,
  escapeRegex,
  getMongoStatus
};
