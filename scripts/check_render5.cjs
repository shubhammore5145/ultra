const https = require('https');

// The root is served via Cloudflare CDN (cf-cache-status: HIT)
// The /login route returns 404 meaning the Express server is NOT serving SPA correctly
// Let's check if the server.js static middleware is working

const checkUrl = (url, options = {}) => {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000, ...options }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', e => resolve({ status: 'ERROR', body: e.message }));
  });
};

async function run() {
  // Try a real API endpoint 
  const auth = await checkUrl('https://s-mart-ed1z.onrender.com/api/auth/me');
  console.log('/api/auth/me status:', auth.status);
  console.log('/api/auth/me body:', auth.body.slice(0, 200));
  
  // The issue: /login returns 404 but root returns 200
  // This means the static file server IS the issue - Render seems to be serving as STATIC host not Express
  // Render might be configured as "Static Site" instead of "Web Service"
  
  // Let's check if it's Express or pure static:
  const assets = await checkUrl('https://s-mart-ed1z.onrender.com/assets/index-Ck6myC_T.js');
  console.log('/assets/index-*.js status:', assets.status);
}

run();
