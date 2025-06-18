const express = require('express');
const request = require('request');
const cors = require('cors');

const app = express();
const PORT = 8080;

app.use(cors());

app.get('/proxy', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('❌ Missing ?url=');
  }

  console.log(`🔁 Proxying to: ${targetUrl}`);

  req.pipe(request(targetUrl))
    .on('error', (err) => {
      console.error('❌ Proxy error:', err.message);
      res.status(502).send('Proxy failed');
    })
    .pipe(res);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy server running at http://0.0.0.0:${PORT}`);
});
