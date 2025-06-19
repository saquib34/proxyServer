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