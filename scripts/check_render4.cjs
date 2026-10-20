const https = require('https');

// Check what the root page looks like on Render
const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, { timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', e => resolve({ status: 'ERROR', body: e.message }));
  });
};

async function run() {
  // Check root - is it the Express server or a static file server?
  const root = await checkUrl('https://s-mart-ed1z.onrender.com');
  console.log('Root headers:', JSON.stringify(root.headers, null, 2));
  console.log('Root body (full):', root.body.slice(0, 800));
}

run();
