const express = require('express');
const puppeteer = require('puppeteer');

const app = express();

app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing target URL');

  console.log(`🔁 Browsing: ${target}`);

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );
    await page.goto(target, { waitUntil: 'networkidle2', timeout: 20000 });

    const content = await page.content();
    await browser.close();

    res.send(content);
  } catch (err) {
    console.error('❌ Puppeteer error:', err.message);
    res.status(500).send('Failed to fetch page.');
  }
});

app.listen(8080, () => {
  console.log('🚀 Puppeteer Proxy running on http://localhost:8080');
});
