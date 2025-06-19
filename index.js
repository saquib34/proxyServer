const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

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
        
        const response = await axios.get(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });
        
        let html = response.data;
        const baseUrl = new URL(fullUrl).origin;
        const currentHost = req.get('host');
        
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
        console.error('Error:', error.message);
        res.status(500).send(`
            <h1>Error</h1>
            <p>Failed to load: ${targetUrl}</p>
            <p>Error: ${error.message}</p>
            <a href="/">Try another URL</a>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/?url=google.com`);
});