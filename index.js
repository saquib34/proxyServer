const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable forced HTTPS redirect
app.enable('trust proxy');
app.use((req, res, next) => {
  // Don't redirect HTTP to HTTPS (important for v86)
  next();
});

// Proxy route
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing ?url= parameter');
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer', // works with HTML/images/binary
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...req.headers, // Forward headers if needed
      },
    });

    // Set headers and status
    res.set(response.headers);
    res.status(response.status).send(response.data);
  } catch (err) {
    console.error('Error proxying request:', err.message);
    res.status(500).send(`Proxy error: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});
