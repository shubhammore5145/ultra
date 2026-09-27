const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

let poolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig = {
    uri: process.env.DATABASE_URL
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'Shubham16@',
    database: process.env.DB_NAME || 'nayashi_kirana',
  };
}

// Enable SSL for cloud databases (TiDB, Aiven, Railway, AWS RDS, etc.)
if (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1')) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

poolConfig.waitForConnections = true;
poolConfig.connectionLimit = 10;
poolConfig.queueLimit = 0;

const pool = mysql.createPool(poolConfig);

// Test connectivity helper
pool.testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`Connected to MySQL database [${process.env.DB_NAME || 'nayashi_kirana'}] on [${process.env.DB_HOST || 'localhost'}]`);
    conn.release();
    return true;
  } catch (err) {
    console.error('MySQL connection error:', err.message);
    return false;
  }
};

module.exports = pool;
