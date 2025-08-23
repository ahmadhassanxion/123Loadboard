const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async (req, res) => {
  const { pickup, dropoff } = req.query;
  
  if (!pickup || !dropoff) {
    return res.status(400).json({ error: 'Missing pickup or dropoff location' });
  }

  // Launch the browser with the local Chrome/Chromium executable
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(60000);

    // Set up request interception
    await page.setRequestInterception(true);
    let apiResponse = null;

    page.on('request', request => {
      request.continue();
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api/ratechecks') && !apiResponse) {
        try {
          const json = await response.json();
          apiResponse = {
            url: url,
            status: response.status(),
            data: json
          };
        } catch (e) {
          console.error('Error parsing JSON:', e);
        }
      }
    });

    // Navigate to login
    await page.goto('https://login.123loadboard.com/', { waitUntil: 'networkidle2' });
    await login(page);
    
    // Navigate to search page
    await page.goto('https://members.123loadboard.com/tools/market-rates-carrier', { 
      waitUntil: 'networkidle2' 
    });
    
    // Perform search
    await page.waitForSelector('#pickup_location_picker', { visible: true, timeout: 10000 });
    await page.type('#pickup_location_picker', pickup);
    await page.waitForSelector('#pickup_location_picker-item-0', { visible: true, timeout: 10000 });
    await page.click('#pickup_location_picker-item-0');
    
    await page.waitForSelector('#dropoff_location_picker', { visible: true, timeout: 10000 });
    await page.type('#dropoff_location_picker', dropoff);
    await page.waitForSelector('#dropoff_location_picker-item-0', { visible: true, timeout: 10000 });
    await page.click('#dropoff_location_picker-item-0');
    
    // Wait for API response or timeout
    await page.waitForFunction(() => window.apiResponse !== undefined, { timeout: 30000 })
      .catch(() => console.log('Waiting for API response timed out'));

    if (!apiResponse) {
      throw new Error('No API response captured');
    }

    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    await browser.close();
  }
};

async function login(page) {
  const email = process.env.EMAIL || "quotes@stretchxlfreight.com";
  const password = process.env.PASSWORD || "B8G@pML$bzftvJN";

  try {
    await page.waitForSelector('#email', { visible: true, timeout: 10000 });
    await page.type('#email', email);
    await page.waitForSelector('#password', { visible: true, timeout: 10000 });
    await page.type('#password', password);
    await page.waitForSelector('#sign-in-button', { visible: true, timeout: 10000 });
    await page.click('#sign-in-button');
    
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Login successful!');
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}
