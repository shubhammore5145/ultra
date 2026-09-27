const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  // Store browser cache inside the project directory so Render includes it in runtime slug
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
