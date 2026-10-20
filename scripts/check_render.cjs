const https = require('https');

// Check Render site status
https.get('https://s-mart-ed1z.onrender.com/login', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Render Status Code:', res.statusCode);
    console.log('Response body (first 500 chars):', data.slice(0, 500));
  });
}).on('error', e => {
  console.log('Error:', e.message);
});

// Also check the root
https.get('https://s-mart-ed1z.onrender.com', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Root Status Code:', res.statusCode);
    console.log('Root response (first 300 chars):', data.slice(0, 300));
  });
}).on('error', e => {
  console.log('Root Error:', e.message);
});
