const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Add CORS middleware for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    
    next();
});

app.use(express.static('public'));

// API endpoint for extension (returns proper content type)
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        // Add protocol if missing - using HTTP like your example
        let fullUrl = targetUrl;
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            fullUrl = 'http://' + targetUrl;
        }
        
        // Use proxy.cors.sh in background with exact format
        const proxyUrl = `https://proxy.cors.sh/${fullUrl}`;
        console.log('API Fetching:', proxyUrl);
        
        const response = await axios.get(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Origin': 'https://cors.sh',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 30000,
            responseType: 'arraybuffer', // Handle binary data
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            }
        });
        
        // Set proper headers
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        // Send the raw response
        res.send(response.data);
        
    } catch (error) {
        console.error('API Proxy error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch URL', 
            details: error.message,
            url: targetUrl 
        });
    }
});

// Main proxy route
app.get('/', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.send(`
            <h1>Simple CORS Proxy</h1>
            <p>Usage: <code>yoursite.com/?url=google.com</code></p>
            <p>Or: <code>yoursite.com/?url=https://example.com</code></p>
        `);
    }
    
    try {
        // Add protocol if missing - using HTTP like your example
        let fullUrl = targetUrl;
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            fullUrl = 'http://' + targetUrl;
        }
        
        // Use proxy.cors.sh in background with exact format
        const proxyUrl = `https://proxy.cors.sh/${fullUrl}`;
        console.log('Fetching:', proxyUrl);
        
        // First try to get the final redirected URL
        let finalUrl = fullUrl;
        try {
            const headResponse = await axios.head(fullUrl, { 
                maxRedirects: 5,
                timeout: 10000,
                validateStatus: () => true 
            });
            if (headResponse.request?.res?.responseUrl) {
                finalUrl = headResponse.request.res.responseUrl;
                console.log('Redirected to:', finalUrl);
            }
        } catch (e) {
            console.log('HEAD request failed, proceeding with original URL');
        }
        
        // Use the final URL with proxy
        const finalProxyUrl = `https://proxy.cors.sh/${finalUrl}`;
        console.log('Final proxy URL:', finalProxyUrl);
        
        const response = await axios.get(finalProxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Origin': 'https://cors.sh',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 30000,
            maxRedirects: 10,
            validateStatus: function (status) {
                return status >= 200 && status < 600; // Accept any status code
            }
        });
        
        let html = response.data;
        const baseUrl = new URL(finalUrl).origin;
        const currentHost = req.get('host');
        
        // Set proper headers for the response
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        
        // Simple URL rewriting for media assets
        html = html.replace(/src=["']([^"']+)["']/gi, (match, url) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                // Already absolute URL
                return `src="/?url=${encodeURIComponent(url)}"`;
            } else if (url.startsWith('//')) {
                // Protocol relative
                return `src="/?url=${encodeURIComponent('https:' + url)}"`;
            } else if (url.startsWith('/')) {
                // Root relative
                return `src="/?url=${encodeURIComponent(baseUrl + url)}"`;
            } else {
                // Relative
                return `src="/?url=${encodeURIComponent(baseUrl + '/' + url)}"`;
            }
        });
        
        // Rewrite href for CSS and links
        html = html.replace(/href=["']([^"']+)["']/gi, (match, url) => {
            if (url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
                return match; // Keep as is
            }
            
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return `href="/?url=${encodeURIComponent(url)}"`;
            } else if (url.startsWith('//')) {
                return `href="/?url=${encodeURIComponent('https:' + url)}"`;
            } else if (url.startsWith('/')) {
                return `href="/?url=${encodeURIComponent(baseUrl + url)}"`;
            } else {
                return `href="/?url=${encodeURIComponent(baseUrl + '/' + url)}"`;
            }
        });
        
        // Rewrite CSS url() functions
        html = html.replace(/url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/gi, (match, url) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return `url("/?url=${encodeURIComponent(url)}")`;
            } else if (url.startsWith('//')) {
                return `url("/?url=${encodeURIComponent('https:' + url)}")`;
            } else if (url.startsWith('/')) {
                return `url("/?url=${encodeURIComponent(baseUrl + url)}")`;
            } else {
                return `url("/?url=${encodeURIComponent(baseUrl + '/' + url)}")`;
            }
        });
        
        res.send(html);
        
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: targetUrl,
            proxyUrl: finalProxyUrl
        });
        
        res.status(500).send(`
            <h1>Proxy Error</h1>
            <p><strong>Failed to load:</strong> ${targetUrl}</p>
            <p><strong>Error:</strong> ${error.message}</p>
            ${error.response ? `<p><strong>Status:</strong> ${error.response.status} ${error.response.statusText}</p>` : ''}
            <p><strong>Proxy URL used:</strong> ${finalProxyUrl}</p>
            <hr>
            <h3>Troubleshooting:</h3>
            <ul>
                <li>Try with www: <a href="/?url=www.${targetUrl.replace(/^https?:\/\//, '')}">${targetUrl.replace(/^https?:\/\//, 'www.')}</a></li>
                <li>Try HTTP instead: <a href="/?url=http://${targetUrl.replace(/^https?:\/\//, '')}">${targetUrl.replace(/^https?:\/\//, 'http://')}</a></li>
                <li>Try direct: <a href="${targetUrl}" target="_blank">${targetUrl}</a></li>
            </ul>
            <a href="/">← Try another URL</a>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/?url=google.com`);
});