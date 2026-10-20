const https = require('https');

// Check the Render deployment - what does /login route serve?
// Login is a React SPA route, so the server should serve index.html for it

const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, { timeout: 10000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 300) }));
    }).on('error', e => resolve({ status: 'ERROR', body: e.message }));
  });
};

async function run() {
  const root = await checkUrl('https://s-mart-ed1z.onrender.com');
  console.log('Root (/):', root.status, root.body.slice(0, 100));
  
  const login = await checkUrl('https://s-mart-ed1z.onrender.com/login');
  console.log('/login:', login.status, login.body.slice(0, 200));
  
  const health = await checkUrl('https://s-mart-ed1z.onrender.com/api/health');
  console.log('/api/health:', health.status, health.body.slice(0, 300));
  
  const ping = await checkUrl('https://s-mart-ed1z.onrender.com/api/ping');
  console.log('/api/ping:', ping.status, ping.body.slice(0, 300));
}

run();
