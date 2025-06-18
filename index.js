const express = require('express');
const axios = require('axios');
const https = require('https');
const app = express();

const PORT = process.env.PORT || 10000;

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing ?url= parameter');
  }

  console.log(`🔁 Proxying: ${targetUrl}`);

  try {
    // Disable SSL verification (unsafe for general use, OK for controlled proxying)
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.get(targetUrl, {
      httpsAgent: agent,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...req.headers, // pass client headers if needed
      },
    });

    // Pass through headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    res.status(500).send(`Proxy error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
});
