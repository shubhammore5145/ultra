const https = require('https');

// Check if the Render site serves SPA routes properly
https.get('https://s-mart-ed1z.onrender.com/assets/', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Assets dir status:', res.statusCode);
  });
}).on('error', e => console.log('Assets Error:', e.message));

// Check /api/health on Render
https.get('https://s-mart-ed1z.onrender.com/api/health', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('API health status:', res.statusCode);
    console.log('API health body:', data.slice(0, 300));
  });
}).on('error', e => console.log('API health Error:', e.message));
