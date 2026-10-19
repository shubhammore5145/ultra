const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Shubham16@'
});

connection.query(`CREATE DATABASE IF NOT EXISTS nayashi_kirana;`, (err, results) => {
  if (err) {
    console.error('Error creating database:', err);
  } else {
    console.log('Database nayashi_kirana is ready!');
  }
  process.exit();
});
