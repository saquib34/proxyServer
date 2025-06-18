// server.js - Complete working proxy server
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: false
}));

// Parse JSON bodies
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'V86 CORS Proxy Server - Working',
    status: 'online',
    usage: {
      endpoint: '/proxy/',
      example: 'https://your-app.onrender.com/proxy/https://example.com',
      note: 'Some sites like Google may block proxy requests'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main proxy endpoint
app.all('/proxy/*', async (req, res) => {
  try {
    // Extract target URL
    let targetUrl = req.url.replace('/proxy/', '');
    
    // Decode URL if encoded
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch (e) {
      // If decode fails, use original
    }

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid HTTP/HTTPS URL',
        example: '/proxy/https://example.com'
      });
    }

    console.log(`${req.method} ${targetUrl}`);

    // Prepare headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': req.headers.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    // Copy some headers from original request
    if (req.headers.referer && !req.headers.referer.includes('proxyserver')) {
      headers.Referer = req.headers.referer;
    }

    // Make the proxied request
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true, // Accept all status codes
      responseType: 'arraybuffer' // Handle binary content
    });

    // Set CORS headers
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'false'
    });

    // Set content headers
    const contentType = response.headers['content-type'] || 'text/html';
    res.set('Content-Type', contentType);

    // Copy important headers
    ['content-length', 'last-modified', 'etag', 'cache-control'].forEach(header => {
      if (response.headers[header]) {
        res.set(header, response.headers[header]);
      }
    });

    // Handle HTML content - fix relative URLs
    if (contentType.includes('text/html')) {
      let content = response.data.toString('utf8');
      const baseUrl = new URL(targetUrl);
      const origin = `${baseUrl.protocol}//${baseUrl.host}`;
      
      // Fix relative URLs
      content = content
        .replace(/href=["']\/([^"']*?)["']/g, `href="/proxy/${origin}/$1"`)
        .replace(/src=["']\/([^"']*?)["']/g, `src="/proxy/${origin}/$1"`)
        .replace(/action=["']\/([^"']*?)["']/g, `action="/proxy/${origin}/$1"`)
        .replace(/url\(["']?\/([^"')]*?)["']?\)/g, `url("/proxy/${origin}/$1")`)
        // Fix protocol-relative URLs
        .replace(/href=["']\/\/([^"']*?)["']/g, `href="/proxy/${baseUrl.protocol}//$1"`)
        .replace(/src=["']\/\/([^"']*?)["']/g, `src="/proxy/${baseUrl.protocol}//$1"`);

      res.status(response.status).send(content);
    } else {
      // Send binary content as-is
      res.status(response.status).send(response.data);
    }

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Handle specific error types
    if (error.code === 'ENOTFOUND') {
      return res.status(404).json({
        error: 'Host not found',
        message: 'The requested website could not be found'
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'The website took too long to respond'
      });
    }

    if (error.response) {
      // Website returned an error
      res.status(error.response.status).json({
        error: 'Website error',
        status: error.response.status,
        message: error.response.statusText || 'Website returned an error'
      });
    } else {
      // Network or other error
      res.status(500).json({
        error: 'Proxy error',
        message: 'Failed to fetch the requested URL'
      });
    }
  }
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Use /proxy/[URL] endpoint',
    example: '/proxy/https://example.com'
  });
});

app.listen(PORT, () => {
  console.log(`V86 CORS Proxy server running on port ${PORT}`);
  console.log('Ready to proxy requests!');
});