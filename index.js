// server.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const request = require('request');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: true
}));

// Root route with usage instructions
app.get('/', (req, res) => {
  res.json({
    message: 'V86 CORS Proxy Server',
    usage: {
      method1: 'https://your-app.onrender.com/proxy/https://google.com',
      method2: 'Configure v86 browser to use this server as HTTP proxy',
      status: 'Server is running'
    },
    examples: [
      'https://your-app.onrender.com/proxy/https://google.com',
      'https://your-app.onrender.com/proxy/http://example.com'
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Proxy endpoint - Method 1: URL parameter
app.all('/proxy/*', (req, res) => {
  const targetUrl = req.url.replace('/proxy/', '');
  
  if (!targetUrl) {
    return res.status(400).json({ 
      error: 'No target URL provided',
      usage: 'https://your-app.onrender.com/proxy/https://google.com'
    });
  }

  console.log(`Proxying ${req.method} request to: ${targetUrl}`);

  const options = {
    url: targetUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: url.parse(targetUrl).host,
      // Remove problematic headers
      origin: undefined,
      referer: undefined,
      'x-forwarded-for': undefined,
      'x-forwarded-proto': undefined,
      'x-forwarded-host': undefined
    },
    followRedirect: true,
    timeout: 30000
  };

  // Handle request body for POST/PUT
  if (req.method === 'POST' || req.method === 'PUT') {
    options.body = req.body;
  }

  request(options)
    .on('error', (err) => {
      console.error('Proxy error:', err);
      res.status(500).json({ 
        error: 'Proxy request failed', 
        details: err.message 
      });
    })
    .pipe(res);
});

// Proxy endpoint - Method 2: Query parameter
app.all('/fetch', (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ 
      error: 'No target URL provided',
      usage: 'https://your-app.onrender.com/fetch?url=https://google.com'
    });
  }

  console.log(`Fetching: ${targetUrl}`);

  const options = {
    url: targetUrl,
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; V86-CORS-Proxy)',
      ...req.headers,
      host: url.parse(targetUrl).host,
      origin: undefined,
      referer: undefined
    },
    followRedirect: true,
    timeout: 30000
  };

  request(options)
    .on('error', (err) => {
      console.error('Fetch error:', err);
      res.status(500).json({ 
        error: 'Fetch request failed', 
        details: err.message 
      });
    })
    .pipe(res);
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Use /proxy/[URL] or /fetch?url=[URL] endpoints'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`V86 CORS Proxy server running on port ${PORT}`);
  console.log(`Usage:`);
});
