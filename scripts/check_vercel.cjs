const https = require('https');

https.get('https://ultra-pi-sandy.vercel.app', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const m = data.match(/\/assets\/index-[^."']+\.js/);
    console.log('Active Bundle on Vercel:', m ? m[0] : 'None found');
  });
}).on('error', e => console.error(e.message));
